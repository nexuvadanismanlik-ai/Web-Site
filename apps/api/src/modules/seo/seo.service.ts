import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { UpsertSeoDto } from './dto/upsert-seo.dto';
import type { UserRole } from '@nexuva/types';

// Single include shape that resolves the full ownership chain in one query:
// SeoSetting → Page → Tenant → Company | Product
const SEO_WITH_OWNER = {
  page: {
    select: {
      id: true,
      tenantId: true,
      slug: true,
      locale: true,
      isPublished: true,
      deletedAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          company: { select: { id: true } },
          product: { select: { companyId: true } },
        },
      },
    },
  },
} as const;

// Lighter shape for the list endpoint (avoids pulling full SEO + page tree for every row)
const SEO_LIST_INCLUDE = {
  page: {
    select: {
      id: true,
      slug: true,
      locale: true,
      tenantId: true,
      tenant: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

@Injectable()
export class SeoService {
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

  /**
   * Resolves the page and verifies the actor owns its tenant.
   * Throws NotFoundException if the page is soft-deleted or does not exist.
   * Throws ForbiddenException if the actor's company does not own the tenant.
   * Returns the page (with tenant) for callers that need it after the check.
   */
  private async assertPageOwnership(
    pageId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        slug: true,
        locale: true,
        tenant: {
          select: {
            id: true,
            name: true,
            company: { select: { id: true } },
            product: { select: { companyId: true } },
          },
        },
      },
    });

    if (!page) throw new NotFoundException(`Page ${pageId} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      const ownerCompanyId = this.resolveOwnerCompanyId(page.tenant);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException(
          'You do not have permission to access SEO settings for this page',
        );
      }
    }

    return page;
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  /**
   * Lists all SEO settings visible to the actor.
   * SUPER_ADMIN: every record in the system.
   * Others: only pages belonging to their company's tenants.
   */
  findAll(actorRole: UserRole, actorCompanyId?: string | null) {
    if (actorRole === 'SUPER_ADMIN') {
      return this.prisma.seoSetting.findMany({
        include: SEO_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.seoSetting.findMany({
      where: {
        page: {
          deletedAt: null,
          tenant: {
            OR: [
              { company: { id: actorCompanyId ?? '__none__' } },
              { product: { companyId: actorCompanyId ?? '__none__' } },
            ],
          },
        },
      },
      include: SEO_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Returns SEO settings for a specific page (ownership-checked).
   * Returns null when no SEO record exists yet — not an error.
   */
  async findByPage(
    pageId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertPageOwnership(pageId, actorRole, actorCompanyId);

    return this.prisma.seoSetting.findUnique({
      where: { pageId },
      include: SEO_WITH_OWNER,
    });
  }

  /**
   * Returns SEO settings for a published page without authentication.
   * Used by SSR middleware (apps/web) to populate <head> meta tags.
   * Only returns data for pages that are published and not soft-deleted.
   */
  async findByPagePublic(pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, isPublished: true, deletedAt: null },
    });

    if (!page) throw new NotFoundException(`Published page ${pageId} not found`);

    return this.prisma.seoSetting.findUnique({ where: { pageId } });
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  /**
   * Creates or partially updates SEO settings for a page.
   * Only supplied fields are written — omitted fields are preserved on update.
   * Ownership-checked via the Page → Tenant → Company chain.
   * Audit logged with before/after state.
   */
  async upsert(
    pageId: string,
    dto: UpsertSeoDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertPageOwnership(pageId, actorRole, actorCompanyId);

    const existing = await this.prisma.seoSetting.findUnique({ where: { pageId } });

    const record = await this.prisma.seoSetting.upsert({
      where: { pageId },
      create: {
        pageId,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
        keywords: dto.keywords ?? [],
        ogImage: dto.ogImage ?? null,
        ogTitle: dto.ogTitle ?? null,
        ogDescription: dto.ogDescription ?? null,
        twitterCard: dto.twitterCard ?? null,
        canonicalUrl: dto.canonicalUrl ?? null,
        noIndex: dto.noIndex ?? false,
      },
      update: {
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
        ...(dto.keywords !== undefined && { keywords: dto.keywords }),
        ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
        ...(dto.ogTitle !== undefined && { ogTitle: dto.ogTitle }),
        ...(dto.ogDescription !== undefined && { ogDescription: dto.ogDescription }),
        ...(dto.twitterCard !== undefined && { twitterCard: dto.twitterCard }),
        ...(dto.canonicalUrl !== undefined && { canonicalUrl: dto.canonicalUrl }),
        ...(dto.noIndex !== undefined && { noIndex: dto.noIndex }),
      },
      include: SEO_WITH_OWNER,
    });

    await this.auditLog.log({
      actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      resource: 'seo_setting',
      resourceId: record.id,
      before: existing
        ? {
            metaTitle: existing.metaTitle,
            metaDescription: existing.metaDescription,
            keywords: existing.keywords,
            ogImage: existing.ogImage,
            twitterCard: existing.twitterCard,
            canonicalUrl: existing.canonicalUrl,
            noIndex: existing.noIndex,
          }
        : undefined,
      after: {
        pageId,
        metaTitle: record.metaTitle,
        metaDescription: record.metaDescription,
        keywords: record.keywords,
        ogImage: record.ogImage,
        twitterCard: record.twitterCard,
        canonicalUrl: record.canonicalUrl,
        noIndex: record.noIndex,
      },
    });

    return record;
  }

  /**
   * Removes SEO settings for a page, resetting it to no metadata.
   * Idempotent — safe to call when no SEO record exists.
   * Ownership-checked; audit logged.
   */
  async remove(
    pageId: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertPageOwnership(pageId, actorRole, actorCompanyId);

    const existing = await this.prisma.seoSetting.findUnique({ where: { pageId } });
    if (!existing) {
      return { removed: true, pageId, hadSeoSettings: false };
    }

    await this.prisma.seoSetting.delete({ where: { pageId } });

    await this.auditLog.log({
      actorId,
      action: 'DELETE',
      resource: 'seo_setting',
      resourceId: existing.id,
      before: {
        pageId,
        metaTitle: existing.metaTitle,
        metaDescription: existing.metaDescription,
        keywords: existing.keywords,
        canonicalUrl: existing.canonicalUrl,
        noIndex: existing.noIndex,
      },
    });

    return { removed: true, pageId, hadSeoSettings: true };
  }
}
