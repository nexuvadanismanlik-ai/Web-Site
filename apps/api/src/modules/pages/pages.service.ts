import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { VersioningService } from '../versioning/versioning.service';
import type { CreatePageDto } from './dto/create-page.dto';
import type { UpdatePageDto } from './dto/update-page.dto';
import type { UserRole } from '@nexuva/types';

// Resolves the ownership chain in a single query: Tenant → Company | Product.
const TENANT_OWNER_SELECT = {
  id: true,
  company: { select: { id: true } },
  product: { select: { companyId: true } },
} as const;

// Shape used for mutation pre-fetch: everything a snapshot/publish/delete needs,
// plus the ownership chain.
const PAGE_FOR_MUTATION = {
  id: true,
  tenantId: true,
  slug: true,
  locale: true,
  title: true,
  isPublished: true,
  currentVersion: true,
  contentBlocks: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' as const },
  },
  tenant: { select: TENANT_OWNER_SELECT },
} as const;

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly versioning: VersioningService,
  ) {}

  // ─── Ownership helpers ────────────────────────────────────────────────────

  private resolveOwnerCompanyId(tenant: {
    company: { id: string } | null;
    product: { companyId: string } | null;
  }): string | null {
    return tenant.company?.id ?? tenant.product?.companyId ?? null;
  }

  /**
   * Verifies the actor owns the given tenant before a list or create operation.
   * SUPER_ADMIN bypasses. Throws NotFound for missing tenant, Forbidden otherwise.
   */
  private async assertTenantOwnership(
    tenantId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ): Promise<void> {
    if (actorRole === 'SUPER_ADMIN') return;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: TENANT_OWNER_SELECT,
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const ownerCompanyId = this.resolveOwnerCompanyId(tenant);
    if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
      throw new ForbiddenException('You do not have permission to access pages for this tenant');
    }
  }

  /**
   * Fetches a page (with the data mutations need) and verifies ownership.
   * Returns the page for the caller to reuse. Throws NotFound for missing /
   * soft-deleted pages, Forbidden for cross-tenant access.
   */
  private async assertPageOwnership(
    pageId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: PAGE_FOR_MUTATION,
    });
    if (!page) throw new NotFoundException(`Page ${pageId} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      const ownerCompanyId = this.resolveOwnerCompanyId(page.tenant);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException('You do not have permission to access this page');
      }
    }

    return page;
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  async findByTenant(
    tenantId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertTenantOwnership(tenantId, actorRole, actorCompanyId);

    return this.prisma.page.findMany({
      where: { tenantId, deletedAt: null },
      include: { seoSetting: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string, actorRole: UserRole, actorCompanyId?: string | null) {
    const page = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
      include: {
        contentBlocks: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
        seoSetting: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 10 },
        tenant: { select: TENANT_OWNER_SELECT },
      },
    });
    if (!page) throw new NotFoundException(`Page ${id} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      const ownerCompanyId = this.resolveOwnerCompanyId(page.tenant);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException('You do not have permission to access this page');
      }
    }

    return page;
  }

  /**
   * Public render path — no auth. Returns a published, non-deleted page only.
   * Used by apps/web SSR. Visible content blocks and SEO are included.
   */
  async findBySlug(tenantId: string, slug: string, locale: string) {
    const page = await this.prisma.page.findFirst({
      where: { tenantId, slug, locale, deletedAt: null, isPublished: true },
      include: {
        contentBlocks: {
          where: { isVisible: true, deletedAt: null },
          orderBy: { position: 'asc' },
        },
        seoSetting: true,
      },
    });
    if (!page) throw new NotFoundException(`Page /${slug} not found`);
    return page;
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  async create(
    dto: CreatePageDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertTenantOwnership(dto.tenantId, actorRole, actorCompanyId);

    const locale = dto.locale ?? 'tr';

    // Pre-check active duplicates for a clear 409. Note: the DB @@unique is
    // [tenantId, slug, locale] and does NOT account for soft-delete, so a
    // soft-deleted page still reserves its slug — the catch below surfaces that.
    const dup = await this.prisma.page.findFirst({
      where: { tenantId: dto.tenantId, slug: dto.slug, locale, deletedAt: null },
    });
    if (dup) {
      throw new ConflictException(
        `A page with slug "${dto.slug}" already exists for this tenant and locale`,
      );
    }

    let page;
    try {
      page = await this.prisma.page.create({
        data: {
          tenantId: dto.tenantId,
          slug: dto.slug,
          title: dto.title,
          locale,
          isPublished: false,
          currentVersion: 1,
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          `Slug "${dto.slug}" is reserved (possibly by a soft-deleted page) for this tenant and locale`,
        );
      }
      throw e;
    }

    await this.auditLog.log({
      actorId,
      action: 'CREATE',
      resource: 'page',
      resourceId: page.id,
      after: { tenantId: page.tenantId, slug: page.slug, title: page.title, locale: page.locale },
    });

    return page;
  }

  /**
   * Updates page metadata (title). Captures the pre-update state as a version
   * snapshot inside the same transaction, then applies the change atomically.
   */
  async update(
    id: string,
    dto: UpdatePageDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const page = await this.assertPageOwnership(id, actorRole, actorCompanyId);

    await this.prisma.$transaction(async (tx) => {
      // Snapshot current state BEFORE the mutation so rollback targets restore
      // the pre-change content.
      await this.versioning.captureVersionInTx(tx, id, actorId);

      await tx.page.update({
        where: { id },
        data: { title: dto.title },
      });
    });

    await this.auditLog.log({
      actorId,
      action: 'UPDATE',
      resource: 'page',
      resourceId: id,
      before: { title: page.title },
      after: { title: dto.title ?? page.title },
    });

    return this.findById(id, actorRole, actorCompanyId);
  }

  /**
   * Publishes a page (DRAFT → PUBLISHED). Idempotent.
   * Snapshots current state before publishing so the published revision is
   * preserved in version history.
   */
  async publish(
    id: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const page = await this.assertPageOwnership(id, actorRole, actorCompanyId);

    if (page.isPublished) {
      return { id, isPublished: true, changed: false };
    }

    await this.prisma.$transaction(async (tx) => {
      await this.versioning.captureVersionInTx(tx, id, actorId);
      await tx.page.update({ where: { id }, data: { isPublished: true } });
    });

    await this.auditLog.log({
      actorId,
      action: 'PUBLISH',
      resource: 'page',
      resourceId: id,
      before: { isPublished: false },
      after: { isPublished: true },
    });

    return { id, isPublished: true, changed: true };
  }

  /**
   * Unpublishes a page (PUBLISHED → DRAFT). Idempotent.
   * Snapshots current state before unpublishing so the transition is versioned.
   */
  async unpublish(
    id: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const page = await this.assertPageOwnership(id, actorRole, actorCompanyId);

    if (!page.isPublished) {
      return { id, isPublished: false, changed: false };
    }

    await this.prisma.$transaction(async (tx) => {
      await this.versioning.captureVersionInTx(tx, id, actorId);
      await tx.page.update({ where: { id }, data: { isPublished: false } });
    });

    await this.auditLog.log({
      actorId,
      action: 'UNPUBLISH',
      resource: 'page',
      resourceId: id,
      before: { isPublished: true },
      after: { isPublished: false },
    });

    return { id, isPublished: false, changed: true };
  }

  async softDelete(
    id: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const page = await this.assertPageOwnership(id, actorRole, actorCompanyId);

    const deleted = await this.prisma.page.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });

    await this.auditLog.log({
      actorId,
      action: 'DELETE',
      resource: 'page',
      resourceId: id,
      before: { slug: page.slug, title: page.title, isPublished: page.isPublished },
    });

    return deleted;
  }
}
