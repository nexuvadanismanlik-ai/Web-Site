import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateSettingDto } from './dto/create-setting.dto';
import type { UpdateSettingDto } from './dto/update-setting.dto';
import type { UserRole } from '@nexuva/types';

// Maximum serialized byte size for a setting value (100 KB).
const MAX_VALUE_BYTES = 100 * 1024;

// Resolves ownership chain: Tenant → Company | Product.
const TENANT_OWNER_SELECT = {
  id: true,
  company: { select: { id: true } },
  product: { select: { companyId: true } },
} as const;

const SETTING_WITH_TENANT = {
  id: true,
  key: true,
  value: true,
  type: true,
  description: true,
  isPublic: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  tenant: { select: TENANT_OWNER_SELECT },
} as const;

@Injectable()
export class SettingsService {
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
   * Verifies the actor has access to a given tenant before creating a setting.
   * Global settings (tenantId = null) are SUPER_ADMIN only.
   */
  async assertTenantOwnership(
    tenantId: string | undefined | null,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ): Promise<void> {
    if (!tenantId) {
      if (actorRole !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Only SUPER_ADMIN may create or manage global settings');
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
      throw new ForbiddenException('You do not have permission to manage settings for this tenant');
    }
  }

  /**
   * Fetches a non-deleted setting and verifies the actor owns its tenant.
   * Returns the setting with tenant data for caller reuse.
   */
  async assertSettingOwnership(
    settingId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { id: settingId, deletedAt: null },
      select: SETTING_WITH_TENANT,
    });
    if (!setting) throw new NotFoundException(`Setting ${settingId} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      if (!setting.tenantId) {
        throw new ForbiddenException('Only SUPER_ADMIN may access global settings');
      }
      const ownerCompanyId = this.resolveOwnerCompanyId(setting.tenant!);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException('You do not have permission to access this setting');
      }
    }

    return setting;
  }

  // ─── Value validation ─────────────────────────────────────────────────────

  /**
   * Validates that the value is consistent with the declared type and within
   * the size limit. Throws BadRequestException on any violation.
   */
  private assertValidValue(value: unknown, type: string): void {
    if (value === undefined || value === null) {
      throw new BadRequestException('value must not be null or undefined');
    }

    switch (type) {
      case 'STRING':
      case 'TEXT':
        if (typeof value !== 'string') {
          throw new BadRequestException(`value must be a string for type ${type}`);
        }
        break;
      case 'NUMBER':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new BadRequestException('value must be a finite number for type NUMBER');
        }
        break;
      case 'BOOLEAN':
        if (typeof value !== 'boolean') {
          throw new BadRequestException('value must be a boolean for type BOOLEAN');
        }
        break;
      case 'JSON':
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          throw new BadRequestException('value must be a non-null object for type JSON');
        }
        break;
    }

    const size = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (size > MAX_VALUE_BYTES) {
      throw new BadRequestException(
        `value exceeds the maximum allowed size of ${MAX_VALUE_BYTES / 1024} KB`,
      );
    }
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  /**
   * Lists non-deleted settings. SUPER_ADMIN sees all (global + all tenants).
   * ADMIN sees only settings belonging to tenants their company owns.
   */
  async findAll(actorRole: UserRole, actorCompanyId?: string | null) {
    if (actorRole === 'SUPER_ADMIN') {
      return this.prisma.systemSetting.findMany({
        where: { deletedAt: null },
        orderBy: [{ tenantId: 'asc' }, { key: 'asc' }],
      });
    }

    return this.prisma.systemSetting.findMany({
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
    const setting = await this.assertSettingOwnership(id, actorRole, actorCompanyId);
    const { tenant: _tenant, ...rest } = setting;
    return rest;
  }

  /**
   * Looks up a setting by key within a specific tenant. Ownership is NOT
   * checked here — this is for internal system use (e.g. tenant middleware).
   */
  async findByKey(tenantId: string, key: string) {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { tenantId, key, deletedAt: null },
    });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found for this tenant`);
    return setting;
  }

  /**
   * Returns only the public settings for a tenant.
   * Exposing only key + value — never description, type, or internal metadata.
   * No authentication required.
   */
  async getPublicSettings(tenantId: string): Promise<Array<{ key: string; value: unknown }>> {
    const settings = await this.prisma.systemSetting.findMany({
      where: { tenantId, isPublic: true, deletedAt: null },
      orderBy: { key: 'asc' },
      select: { key: true, value: true },
    });
    return settings;
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  async create(
    dto: CreateSettingDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertTenantOwnership(dto.tenantId, actorRole, actorCompanyId);
    this.assertValidValue(dto.value, dto.type);

    // Pre-check duplicate key for a clear 409.
    const dup = await this.prisma.systemSetting.findFirst({
      where: { key: dto.key, tenantId: dto.tenantId ?? null, deletedAt: null },
    });
    if (dup) {
      throw new ConflictException(
        `A setting with key "${dto.key}" already exists for this tenant`,
      );
    }

    let setting;
    try {
      setting = await this.prisma.systemSetting.create({
        data: {
          key: dto.key,
          value: dto.value as object,
          type: dto.type,
          tenantId: dto.tenantId ?? null,
          description: dto.description ?? null,
          isPublic: dto.isPublic ?? false,
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          `Setting key "${dto.key}" is already taken for this tenant`,
        );
      }
      throw e;
    }

    await this.auditLog.log({
      actorId,
      action: 'CREATE_SETTING',
      resource: 'system_setting',
      resourceId: setting.id,
      after: {
        key: setting.key,
        type: setting.type,
        tenantId: setting.tenantId,
        isPublic: setting.isPublic,
      },
    });

    return setting;
  }

  async update(
    id: string,
    dto: UpdateSettingDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.assertSettingOwnership(id, actorRole, actorCompanyId);

    // Determine effective type for value validation.
    const effectiveType = dto.type ?? before.type;
    if (dto.value !== undefined) {
      this.assertValidValue(dto.value, effectiveType);
    }

    const updated = await this.prisma.systemSetting.update({
      where: { id },
      data: {
        ...(dto.value !== undefined && { value: dto.value as object }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      },
    });

    await this.auditLog.log({
      actorId,
      action: 'UPDATE_SETTING',
      resource: 'system_setting',
      resourceId: id,
      before: {
        value: before.value,
        type: before.type,
        description: before.description,
        isPublic: before.isPublic,
      },
      after: {
        value: updated.value,
        type: updated.type,
        description: updated.description,
        isPublic: updated.isPublic,
      },
    });

    return updated;
  }

  async remove(
    id: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.assertSettingOwnership(id, actorRole, actorCompanyId);

    const deleted = await this.prisma.systemSetting.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLog.log({
      actorId,
      action: 'DELETE_SETTING',
      resource: 'system_setting',
      resourceId: id,
      before: {
        key: before.key,
        type: before.type,
        tenantId: before.tenantId,
        isPublic: before.isPublic,
      },
    });

    return { id: deleted.id, deleted: true };
  }
}
