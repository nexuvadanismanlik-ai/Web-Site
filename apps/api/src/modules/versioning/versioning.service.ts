import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { UserRole } from '@nexuva/types';

// Resolves ownership chain: Tenant → Company | Product
const TENANT_OWNER_SELECT = {
  id: true,
  company: { select: { id: true } },
  product: { select: { companyId: true } },
} as const;

const PAGE_OWNERSHIP_SELECT = {
  id: true,
  tenantId: true,
  title: true,
  slug: true,
  locale: true,
  isPublished: true,
  tenant: { select: TENANT_OWNER_SELECT },
} as const;

@Injectable()
export class VersioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ─── Ownership helpers ────────────────────────────────────────────────────

  private resolveOwnerCompanyId(tenant: {
    company: { id: string } | null;
    product: { companyId: string } | null;
  }): string | null {
    return tenant.company?.id ?? tenant.product?.companyId ?? null;
  }

  private async assertPageOwnership(
    pageId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: PAGE_OWNERSHIP_SELECT,
    });
    if (!page) throw new NotFoundException(`Page ${pageId} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      const ownerCompanyId = this.resolveOwnerCompanyId(page.tenant);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException('You do not have permission to access versions for this page');
      }
    }
    return page;
  }

  private async assertVersionOwnership(
    versionId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const version = await this.prisma.pageVersion.findUnique({
      where: { id: versionId },
      include: {
        page: { select: PAGE_OWNERSHIP_SELECT },
      },
    });
    if (!version) throw new NotFoundException(`Version ${versionId} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      const ownerCompanyId = this.resolveOwnerCompanyId(version.page.tenant);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException('You do not have permission to access this version');
      }
    }
    return version;
  }

  // ─── Version capture (used transactionally by other services) ────────────

  /**
   * Captures a full page snapshot and inserts a PageVersion row.
   * Accepts an existing Prisma transaction client so callers can
   * include version creation atomically with their own mutations.
   *
   * Snapshot includes:
   *   contentSnapshot — current non-deleted blocks (type, position, content, isVisible)
   *   seoSnapshot     — current SEO setting if present
   *   title           — page title at time of capture
   */
  async captureVersionInTx(
    tx: Prisma.TransactionClient,
    pageId: string,
    actorId: string,
  ): Promise<void> {
    const [page, blocks, seo, last] = await Promise.all([
      tx.page.findUnique({
        where: { id: pageId },
        select: { title: true, slug: true, locale: true, isPublished: true },
      }),
      tx.contentBlock.findMany({
        where: { pageId, deletedAt: null },
        orderBy: { position: 'asc' },
        select: { type: true, content: true, position: true, isVisible: true },
      }),
      tx.seoSetting.findUnique({ where: { pageId } }),
      tx.pageVersion.findFirst({
        where: { pageId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      }),
    ]);

    if (!page) return; // page deleted mid-transaction; bail silently

    const versionNumber = (last?.versionNumber ?? 0) + 1;

    await tx.pageVersion.create({
      data: {
        pageId,
        versionNumber,
        title: page.title,
        contentSnapshot: blocks as unknown as Prisma.InputJsonValue,
        seoSnapshot: seo
          ? ({
              metaTitle: seo.metaTitle,
              metaDescription: seo.metaDescription,
              keywords: seo.keywords,
              ogImage: seo.ogImage,
              ogTitle: seo.ogTitle,
              ogDescription: seo.ogDescription,
              twitterCard: seo.twitterCard,
              canonicalUrl: seo.canonicalUrl,
              noIndex: seo.noIndex,
            } as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        createdById: actorId,
      },
    });
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  async getVersions(pageId: string, actorRole: UserRole, actorCompanyId?: string | null) {
    await this.assertPageOwnership(pageId, actorRole, actorCompanyId);

    return this.prisma.pageVersion.findMany({
      where: { pageId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        pageId: true,
        versionNumber: true,
        title: true,
        createdAt: true,
        createdById: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async getVersion(versionId: string, actorRole: UserRole, actorCompanyId?: string | null) {
    return this.assertVersionOwnership(versionId, actorRole, actorCompanyId);
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  /**
   * Manually creates a version snapshot. Useful when an operator wants to
   * checkpoint state without triggering a content change.
   */
  async createVersion(
    pageId: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ): Promise<{ versionNumber: number }> {
    const page = await this.assertPageOwnership(pageId, actorRole, actorCompanyId);

    let versionNumber = 0;
    await this.prisma.$transaction(async (tx) => {
      await this.captureVersionInTx(tx, pageId, actorId);
      const last = await tx.pageVersion.findFirst({
        where: { pageId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      versionNumber = last?.versionNumber ?? 1;
    });

    await this.auditLog.log({
      actorId,
      action: 'CREATE_VERSION',
      resource: 'page_version',
      resourceId: pageId,
      after: { pageId, title: page.title, versionNumber },
    });

    return { versionNumber };
  }

  /**
   * Rollback: creates a new version whose content comes from the target
   * version's snapshot. History is never modified — only new versions are appended.
   *
   * Example: at Version 5, rollback to Version 3 → creates Version 6 from V3 snapshot.
   */
  async rollback(
    pageId: string,
    versionId: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertPageOwnership(pageId, actorRole, actorCompanyId);

    const target = await this.assertVersionOwnership(versionId, actorRole, actorCompanyId);
    if (target.pageId !== pageId) {
      throw new BadRequestException(`Version ${versionId} does not belong to page ${pageId}`);
    }

    const blocks = target.contentSnapshot as Array<Record<string, unknown>>;

    let newVersion: { versionNumber: number } | null = null;

    await this.prisma.$transaction(async (tx) => {
      // Delete existing live blocks (hard-delete inside transaction; soft-deletes are fine too
      // but we need a clean slate that exactly matches the snapshot).
      await tx.contentBlock.deleteMany({ where: { pageId } });

      for (const block of blocks) {
        await tx.contentBlock.create({
          data: {
            pageId,
            type: block['type'] as never,
            content: block['content'] as Prisma.InputJsonValue,
            position: block['position'] as number,
            isVisible: (block['isVisible'] as boolean) ?? true,
          },
        });
      }

      await tx.page.update({
        where: { id: pageId },
        data: { title: target.title },
      });

      // Snapshot the newly restored state as a new version
      await this.captureVersionInTx(tx, pageId, actorId);

      const last = await tx.pageVersion.findFirst({
        where: { pageId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      newVersion = { versionNumber: last?.versionNumber ?? 1 };
    });

    await this.auditLog.log({
      actorId,
      action: 'ROLLBACK',
      resource: 'page_version',
      resourceId: pageId,
      before: { rolledBackFrom: 'current' },
      after: { restoredFromVersionId: versionId, restoredFromVersionNumber: target.versionNumber, newVersionNumber: newVersion!.versionNumber },
    });

    return {
      pageId,
      restoredFromVersion: target.versionNumber,
      newVersionNumber: newVersion!.versionNumber,
    };
  }

  /**
   * Restore: identical to rollback but also restores SEO data from the version's
   * seoSnapshot if present.
   */
  async restore(
    pageId: string,
    versionId: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertPageOwnership(pageId, actorRole, actorCompanyId);

    const target = await this.assertVersionOwnership(versionId, actorRole, actorCompanyId);
    if (target.pageId !== pageId) {
      throw new BadRequestException(`Version ${versionId} does not belong to page ${pageId}`);
    }

    const blocks = target.contentSnapshot as Array<Record<string, unknown>>;
    const seo = target.seoSnapshot as Record<string, unknown> | null;

    let newVersionNumber = 0;

    await this.prisma.$transaction(async (tx) => {
      // Restore blocks
      await tx.contentBlock.deleteMany({ where: { pageId } });

      for (const block of blocks) {
        await tx.contentBlock.create({
          data: {
            pageId,
            type: block['type'] as never,
            content: block['content'] as Prisma.InputJsonValue,
            position: block['position'] as number,
            isVisible: (block['isVisible'] as boolean) ?? true,
          },
        });
      }

      // Restore page title
      await tx.page.update({
        where: { id: pageId },
        data: { title: target.title },
      });

      // Restore SEO if the snapshot includes it
      if (seo) {
        await tx.seoSetting.upsert({
          where: { pageId },
          create: {
            pageId,
            metaTitle: seo['metaTitle'] as string | null,
            metaDescription: seo['metaDescription'] as string | null,
            keywords: (seo['keywords'] as string[]) ?? [],
            ogImage: seo['ogImage'] as string | null,
            ogTitle: seo['ogTitle'] as string | null,
            ogDescription: seo['ogDescription'] as string | null,
            twitterCard: seo['twitterCard'] as string | null,
            canonicalUrl: seo['canonicalUrl'] as string | null,
            noIndex: (seo['noIndex'] as boolean) ?? false,
          },
          update: {
            metaTitle: seo['metaTitle'] as string | null,
            metaDescription: seo['metaDescription'] as string | null,
            keywords: (seo['keywords'] as string[]) ?? [],
            ogImage: seo['ogImage'] as string | null,
            ogTitle: seo['ogTitle'] as string | null,
            ogDescription: seo['ogDescription'] as string | null,
            twitterCard: seo['twitterCard'] as string | null,
            canonicalUrl: seo['canonicalUrl'] as string | null,
            noIndex: (seo['noIndex'] as boolean) ?? false,
          },
        });
      }

      // Snapshot restored state as a new version
      await this.captureVersionInTx(tx, pageId, actorId);

      const last = await tx.pageVersion.findFirst({
        where: { pageId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      newVersionNumber = last?.versionNumber ?? 1;
    });

    await this.auditLog.log({
      actorId,
      action: 'RESTORE',
      resource: 'page_version',
      resourceId: pageId,
      before: { restoredFrom: 'current' },
      after: {
        restoredFromVersionId: versionId,
        restoredFromVersionNumber: target.versionNumber,
        newVersionNumber,
        seoRestored: !!seo,
      },
    });

    return {
      pageId,
      restoredFromVersion: target.versionNumber,
      newVersionNumber,
      seoRestored: !!seo,
    };
  }

  /**
   * SUPER_ADMIN only. Permanently deletes a version record from history.
   * This is a destructive operation — it cannot be undone.
   */
  async deleteVersion(versionId: string, actorId: string, actorRole: UserRole) {
    if (actorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN may delete version records');
    }

    const version = await this.prisma.pageVersion.findUnique({
      where: { id: versionId },
      select: { id: true, pageId: true, versionNumber: true, title: true },
    });
    if (!version) throw new NotFoundException(`Version ${versionId} not found`);

    await this.prisma.pageVersion.delete({ where: { id: versionId } });

    await this.auditLog.log({
      actorId,
      action: 'DELETE_VERSION',
      resource: 'page_version',
      resourceId: versionId,
      before: {
        pageId: version.pageId,
        versionNumber: version.versionNumber,
        title: version.title,
      },
    });

    return { id: versionId, deleted: true };
  }
}
