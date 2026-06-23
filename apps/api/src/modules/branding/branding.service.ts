import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { UpsertBrandingDto } from './dto/upsert-branding.dto';
import type { UserRole } from '@nexuva/types';

// Tenant ownership include — same pattern used across all tenant-scoped modules.
const TENANT_OWNER_INCLUDE = {
  company: { select: { id: true } },
  product: { select: { companyId: true } },
} as const;

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ─── Ownership helper ─────────────────────────────────────────────────────

  /**
   * Resolves the companyId that owns a tenant.
   * A company tenant is owned directly; a product tenant is owned via its company.
   */
  private resolveOwnerCompanyId(
    tenant: {
      company: { id: string } | null;
      product: { companyId: string } | null;
    },
  ): string | null {
    return tenant.company?.id ?? tenant.product?.companyId ?? null;
  }

  /**
   * Throws ForbiddenException if the actor does not own the given tenantId.
   * SUPER_ADMIN bypasses this check.
   */
  private async assertTenantOwnership(
    tenantId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ): Promise<void> {
    if (actorRole === 'SUPER_ADMIN') return;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: TENANT_OWNER_INCLUDE,
    });

    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const ownerCompanyId = this.resolveOwnerCompanyId(tenant);
    if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
      throw new ForbiddenException(
        'You do not have permission to access branding for this tenant',
      );
    }
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  /**
   * Lists branding records visible to the actor.
   * SUPER_ADMIN: all records.
   * Others: only tenants belonging to their company (company tenant + product tenants).
   */
  findAll(actorRole: UserRole, actorCompanyId?: string | null) {
    if (actorRole === 'SUPER_ADMIN') {
      return this.prisma.branding.findMany({
        include: { tenant: { select: { id: true, name: true, slug: true, type: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.branding.findMany({
      where: {
        tenant: {
          OR: [
            { company: { id: actorCompanyId ?? '__none__' } },
            { product: { companyId: actorCompanyId ?? '__none__' } },
          ],
        },
      },
      include: { tenant: { select: { id: true, name: true, slug: true, type: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Returns branding for a specific tenant (ownership-checked).
   * Returns null when no branding record exists (not an error — tenant has no custom branding yet).
   */
  async findByTenant(
    tenantId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertTenantOwnership(tenantId, actorRole, actorCompanyId);

    return this.prisma.branding.findUnique({
      where: { tenantId },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  /**
   * Creates or fully updates branding for a tenant.
   * All fields are optional — only supplied fields are written.
   * Ownership-checked; creates an audit record capturing before/after state.
   */
  async upsert(
    tenantId: string,
    dto: UpsertBrandingDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertTenantOwnership(tenantId, actorRole, actorCompanyId);

    const existing = await this.prisma.branding.findUnique({ where: { tenantId } });

    const record = await this.prisma.branding.upsert({
      where: { tenantId },
      create: {
        tenantId,
        logoUrl: dto.logoUrl ?? null,
        faviconUrl: dto.faviconUrl ?? null,
        primaryColor: dto.primaryColor ?? null,
        secondaryColor: dto.secondaryColor ?? null,
        accentColor: dto.accentColor ?? null,
        fontHeading: dto.fontHeading ?? null,
        fontBody: dto.fontBody ?? null,
        themePreset: dto.themePreset ?? null,
        customCss: dto.customCss ?? null,
        config: dto.config ?? undefined,
      },
      update: {
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.faviconUrl !== undefined && { faviconUrl: dto.faviconUrl }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
        ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
        ...(dto.fontHeading !== undefined && { fontHeading: dto.fontHeading }),
        ...(dto.fontBody !== undefined && { fontBody: dto.fontBody }),
        ...(dto.themePreset !== undefined && { themePreset: dto.themePreset }),
        ...(dto.customCss !== undefined && { customCss: dto.customCss }),
        ...(dto.config !== undefined && { config: dto.config }),
      },
    });

    await this.auditLog.log({
      actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      resource: 'branding',
      resourceId: record.id,
      before: existing
        ? {
            logoUrl: existing.logoUrl,
            faviconUrl: existing.faviconUrl,
            primaryColor: existing.primaryColor,
            secondaryColor: existing.secondaryColor,
            accentColor: existing.accentColor,
            fontHeading: existing.fontHeading,
            fontBody: existing.fontBody,
            themePreset: existing.themePreset,
          }
        : undefined,
      after: {
        tenantId,
        logoUrl: record.logoUrl,
        faviconUrl: record.faviconUrl,
        primaryColor: record.primaryColor,
        secondaryColor: record.secondaryColor,
        accentColor: record.accentColor,
        fontHeading: record.fontHeading,
        fontBody: record.fontBody,
        themePreset: record.themePreset,
      },
    });

    return record;
  }

  /**
   * Removes the branding record for a tenant, resetting it to platform defaults.
   * Ownership-checked; SUPER_ADMIN may reset any tenant's branding.
   */
  async reset(
    tenantId: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertTenantOwnership(tenantId, actorRole, actorCompanyId);

    const existing = await this.prisma.branding.findUnique({ where: { tenantId } });
    if (!existing) {
      // Idempotent — no branding to reset
      return { reset: true, tenantId, hadBranding: false };
    }

    await this.prisma.branding.delete({ where: { tenantId } });

    await this.auditLog.log({
      actorId,
      action: 'DELETE',
      resource: 'branding',
      resourceId: existing.id,
      before: {
        tenantId,
        logoUrl: existing.logoUrl,
        primaryColor: existing.primaryColor,
        secondaryColor: existing.secondaryColor,
        themePreset: existing.themePreset,
      },
    });

    return { reset: true, tenantId, hadBranding: true };
  }
}
