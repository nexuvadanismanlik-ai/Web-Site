import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import type { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import type { UserRole } from '@nexuva/types';

// Maximum serialized size of a flag's config payload (10 KB).
const MAX_CONFIG_BYTES = 10 * 1024;

// Resolves the ownership chain: Tenant → Company | Product.
const TENANT_OWNER_SELECT = {
  id: true,
  company: { select: { id: true } },
  product: { select: { companyId: true } },
} as const;

// Include shape used for flag ownership traversal.
const FLAG_WITH_TENANT = {
  id: true,
  key: true,
  name: true,
  description: true,
  tenantId: true,
  isEnabled: true,
  config: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  tenant: { select: TENANT_OWNER_SELECT },
} as const;

@Injectable()
export class FeatureFlagsService {
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
   * Verifies the actor has access to a given tenant before creating a flag.
   * Global flags (tenantId = null) are SUPER_ADMIN only.
   */
  async assertTenantOwnership(
    tenantId: string | undefined | null,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ): Promise<void> {
    // Global flags (no tenantId) are reserved for SUPER_ADMIN.
    if (!tenantId) {
      if (actorRole !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Only SUPER_ADMIN may create or manage global feature flags');
      }
      return;
    }

    if (actorRole === 'SUPER_ADMIN') return;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: TENANT_OWNER_SELECT,
    });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const ownerCompanyId = this.resolveOwnerCompanyId(tenant);
    if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
      throw new ForbiddenException('You do not have permission to manage feature flags for this tenant');
    }
  }

  /**
   * Fetches a non-deleted feature flag and verifies ownership.
   * Returns the flag with its tenant for the caller to reuse.
   */
  async assertFeatureFlagOwnership(
    flagId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const flag = await this.prisma.featureFlag.findFirst({
      where: { id: flagId, deletedAt: null },
      select: FLAG_WITH_TENANT,
    });
    if (!flag) throw new NotFoundException(`Feature flag ${flagId} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      // Global flags (tenantId = null) are only readable/writable by SUPER_ADMIN.
      if (!flag.tenantId) {
        throw new ForbiddenException('Only SUPER_ADMIN may access global feature flags');
      }
      const ownerCompanyId = this.resolveOwnerCompanyId(flag.tenant!);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException('You do not have permission to access this feature flag');
      }
    }

    return flag;
  }

  /**
   * Guards against oversized config payloads.
   */
  private assertValidConfig(config: Record<string, unknown>): void {
    if (typeof config !== 'object' || Array.isArray(config) || config === null) {
      throw new BadRequestException('config must be a non-null JSON object');
    }
    const size = Buffer.byteLength(JSON.stringify(config), 'utf8');
    if (size > MAX_CONFIG_BYTES) {
      throw new BadRequestException(
        `config exceeds the maximum allowed size of ${MAX_CONFIG_BYTES / 1024} KB`,
      );
    }
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  /**
   * Lists non-deleted feature flags. SUPER_ADMIN sees all (global + all tenants).
   * ADMIN sees only flags belonging to tenants their company owns.
   */
  async findAll(actorRole: UserRole, actorCompanyId?: string | null) {
    if (actorRole === 'SUPER_ADMIN') {
      return this.prisma.featureFlag.findMany({
        where: { deletedAt: null },
        orderBy: [{ tenantId: 'asc' }, { key: 'asc' }],
      });
    }

    return this.prisma.featureFlag.findMany({
      where: {
        deletedAt: null,
        tenant: {
          OR: [
            { company: { id: actorCompanyId ?? '' } },
            { product: { companyId: actorCompanyId ?? '' } },
          ],
        },
      },
      orderBy: { key: 'asc' },
    });
  }

  async findById(id: string, actorRole: UserRole, actorCompanyId?: string | null) {
    const flag = await this.assertFeatureFlagOwnership(id, actorRole, actorCompanyId);
    // Strip the tenant join data before returning.
    const { tenant: _tenant, ...rest } = flag;
    return rest;
  }

  /**
   * Looks up a flag by key within a specific tenant. Used for system-internal checks.
   * Does NOT expose config or internal data — returns enabled state only.
   */
  async findByKey(key: string, tenantId: string) {
    const flag = await this.prisma.featureFlag.findFirst({
      where: { key, tenantId, deletedAt: null },
      select: { id: true, key: true, isEnabled: true },
    });
    if (!flag) throw new NotFoundException(`Feature flag "${key}" not found for this tenant`);
    return flag;
  }

  /**
   * Public/system consumers: safely check whether a feature is enabled for a
   * given tenant. Tenant flag takes precedence over global flag. Returns false
   * if the flag does not exist. Never exposes config or deleted flags.
   */
  async isFeatureEnabled(tenantId: string, key: string): Promise<boolean> {
    // Tenant-specific flag takes precedence.
    const tenantFlag = await this.prisma.featureFlag.findFirst({
      where: { key, tenantId, deletedAt: null },
      select: { isEnabled: true },
    });
    if (tenantFlag !== null) return tenantFlag.isEnabled;

    // Fall back to global flag (tenantId = null).
    const globalFlag = await this.prisma.featureFlag.findFirst({
      where: { key, tenantId: null, deletedAt: null },
      select: { isEnabled: true },
    });
    return globalFlag?.isEnabled ?? false;
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  async create(
    dto: CreateFeatureFlagDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertTenantOwnership(dto.tenantId, actorRole, actorCompanyId);

    if (dto.config !== undefined) {
      this.assertValidConfig(dto.config);
    }

    // Pre-check for duplicate key within the same tenant scope for a clear 409.
    const dup = await this.prisma.featureFlag.findFirst({
      where: {
        key: dto.key,
        tenantId: dto.tenantId ?? null,
        deletedAt: null,
      },
    });
    if (dup) {
      throw new ConflictException(
        `A feature flag with key "${dto.key}" already exists for this tenant`,
      );
    }

    let flag;
    try {
      flag = await this.prisma.featureFlag.create({
        data: {
          key: dto.key,
          name: dto.name,
          description: dto.description,
          tenantId: dto.tenantId ?? null,
          isEnabled: dto.isEnabled ?? false,
          config: dto.config ? (dto.config as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          `Feature flag key "${dto.key}" is already taken for this tenant`,
        );
      }
      throw e;
    }

    await this.auditLog.log({
      actorId,
      action: 'CREATE',
      resource: 'feature_flag',
      resourceId: flag.id,
      after: {
        key: flag.key,
        name: flag.name,
        tenantId: flag.tenantId,
        isEnabled: flag.isEnabled,
      },
    });

    return flag;
  }

  async update(
    id: string,
    dto: UpdateFeatureFlagDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.assertFeatureFlagOwnership(id, actorRole, actorCompanyId);

    if (dto.config !== undefined) {
      this.assertValidConfig(dto.config);
    }

    const updated = await this.prisma.featureFlag.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.config !== undefined && {
          config: dto.config ? (dto.config as Prisma.InputJsonValue) : Prisma.JsonNull,
        }),
      },
    });

    await this.auditLog.log({
      actorId,
      action: 'UPDATE',
      resource: 'feature_flag',
      resourceId: id,
      before: { name: before.name, description: before.description, config: before.config },
      after: { name: updated.name, description: updated.description, config: updated.config },
    });

    return updated;
  }

  /**
   * Enables or disables a feature flag. Idempotent — re-toggling to the same
   * state is a no-op (no DB write, no audit event).
   */
  async toggle(
    id: string,
    isEnabled: boolean,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.assertFeatureFlagOwnership(id, actorRole, actorCompanyId);

    if (before.isEnabled === isEnabled) {
      return { id, isEnabled, changed: false };
    }

    const updated = await this.prisma.featureFlag.update({
      where: { id },
      data: { isEnabled },
    });

    await this.auditLog.log({
      actorId,
      action: isEnabled ? 'ENABLE' : 'DISABLE',
      resource: 'feature_flag',
      resourceId: id,
      before: { isEnabled: before.isEnabled },
      after: { isEnabled: updated.isEnabled },
    });

    return { id, isEnabled: updated.isEnabled, changed: true };
  }

  async softDelete(
    id: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.assertFeatureFlagOwnership(id, actorRole, actorCompanyId);

    const deleted = await this.prisma.featureFlag.update({
      where: { id },
      data: { deletedAt: new Date(), isEnabled: false },
    });

    await this.auditLog.log({
      actorId,
      action: 'DELETE',
      resource: 'feature_flag',
      resourceId: id,
      before: {
        key: before.key,
        name: before.name,
        tenantId: before.tenantId,
        isEnabled: before.isEnabled,
      },
    });

    return { id: deleted.id, deleted: true };
  }
}
