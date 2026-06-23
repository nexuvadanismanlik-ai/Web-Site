import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ROLE_HIERARCHY } from '@nexuva/shared';
import type { UserRole } from '@nexuva/types';

export interface RoleInfo {
  role: UserRole;
  weight: number;
  canInherit: UserRole[];
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Returns the static role hierarchy — weights and inheritance chain.
   * This never changes at runtime; it is derived from ROLE_HIERARCHY constants.
   */
  getHierarchy(): RoleInfo[] {
    const roles = Object.entries(ROLE_HIERARCHY) as [UserRole, number][];
    const sorted = roles.sort((a, b) => b[1] - a[1]);

    return sorted.map(([role, weight]) => ({
      role,
      weight,
      // A role "inherits" all roles with equal or lower weight
      canInherit: sorted
        .filter(([, w]) => w <= weight)
        .map(([r]) => r),
    }));
  }

  /**
   * Returns all stored permission records, grouped by role.
   */
  async getMatrix(): Promise<Record<UserRole, Array<{ resource: string; actions: unknown }>>> {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ role: 'asc' }, { resource: 'asc' }],
    });

    const matrix = {} as Record<UserRole, Array<{ resource: string; actions: unknown }>>;

    for (const row of rows) {
      if (!matrix[row.role as UserRole]) {
        matrix[row.role as UserRole] = [];
      }
      matrix[row.role as UserRole]!.push({ resource: row.resource, actions: row.actions });
    }

    return matrix;
  }

  /**
   * Returns all stored permissions for a specific role.
   */
  getForRole(role: UserRole) {
    return this.prisma.permission.findMany({
      where: { role },
      orderBy: { resource: 'asc' },
    });
  }

  /**
   * Upserts a permission record for a given role + resource pair.
   * Only SUPER_ADMIN can call this — enforced at controller level.
   */
  async setPermission(
    role: UserRole,
    resource: string,
    actions: Record<string, boolean>,
    actorId: string,
  ) {
    const existing = await this.prisma.permission.findUnique({
      where: { role_resource: { role, resource } },
    });

    const record = await this.prisma.permission.upsert({
      where: { role_resource: { role, resource } },
      create: { role, resource, actions },
      update: { actions },
    });

    await this.auditLog.log({
      actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      resource: 'permission',
      resourceId: record.id,
      before: existing ? { role, resource, actions: existing.actions } : undefined,
      after: { role, resource, actions },
    });

    return record;
  }

  /**
   * Removes a stored permission record. Deleting a permission does not block
   * access — it only removes the explicit record. Route-level guards remain.
   */
  async removePermission(role: UserRole, resource: string, actorId: string) {
    const existing = await this.prisma.permission.findUnique({
      where: { role_resource: { role, resource } },
    });

    if (!existing) return { deleted: false };

    await this.prisma.permission.delete({
      where: { role_resource: { role, resource } },
    });

    await this.auditLog.log({
      actorId,
      action: 'DELETE',
      resource: 'permission',
      resourceId: existing.id,
      before: { role, resource, actions: existing.actions },
    });

    return { deleted: true, role, resource };
  }
}
