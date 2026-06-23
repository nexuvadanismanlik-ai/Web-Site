import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ROLE_HIERARCHY } from '@nexuva/shared';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UserRole } from '@nexuva/types';

// Never return passwordHash in any response
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  companyId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ─── Privilege helpers ────────────────────────────────────────────────────

  /**
   * A caller cannot assign or promote a user to a role whose numeric weight
   * exceeds their own. SUPER_ADMIN (100) can assign anything.
   * Example: ADMIN (80) cannot create/promote to SUPER_ADMIN (100).
   */
  private assertNoEscalation(actorRole: UserRole, targetRole: UserRole): void {
    if (ROLE_HIERARCHY[targetRole] > ROLE_HIERARCHY[actorRole]) {
      throw new ForbiddenException(
        `You cannot assign a role higher than your own (${actorRole})`,
      );
    }
  }

  /**
   * Verifies that a companyId provided in a create/update DTO belongs to the
   * actor's company. SUPER_ADMIN may assign users to any company.
   */
  private async assertCompanyOwnership(
    companyId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ): Promise<void> {
    if (actorRole === 'SUPER_ADMIN') return;

    // Non-SUPER_ADMIN can only create users within their own company
    if (companyId !== actorCompanyId) {
      throw new ForbiddenException(
        'You can only assign users to your own company',
      );
    }

    const company = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) throw new NotFoundException(`Company ${companyId} not found`);
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  /**
   * Used exclusively by JwtStrategy to load the authenticated user's own record.
   * No ownership check — the caller IS the subject, not a third party.
   */
  async findByIdForAuth(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
  }

  findAll(actorRole: UserRole, actorCompanyId?: string | null) {
    const where =
      actorRole === 'SUPER_ADMIN'
        ? { deletedAt: null }
        : { deletedAt: null, companyId: actorCompanyId ?? '__none__' };

    return this.prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(
    id: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException(`User ${id} not found`);

    // SUPER_ADMIN can see any user. Others are scoped to their company.
    if (actorRole !== 'SUPER_ADMIN' && user.companyId !== actorCompanyId) {
      throw new ForbiddenException('Access denied to this user');
    }

    return user;
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  async create(
    dto: CreateUserDto,
    passwordHash: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    // Privilege escalation check: actor cannot create a user with a higher role
    this.assertNoEscalation(actorRole, dto.role);

    // Company ownership check
    if (dto.companyId) {
      await this.assertCompanyOwnership(dto.companyId, actorRole, actorCompanyId);
    }

    // Duplicate email check
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        role: dto.role,
        companyId: dto.companyId ?? null,
      },
      select: USER_SELECT,
    });

    await this.auditLog.log({
      actorId,
      action: 'CREATE',
      resource: 'user',
      resourceId: user.id,
      after: {
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    });

    return user;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    // Scope check first — loads the target user and verifies company membership
    const before = await this.findById(id, actorRole, actorCompanyId);

    // A user cannot change their own role or active status through this endpoint.
    // Self-service profile updates (firstName, lastName) are allowed.
    if (id === actorId && (dto.role !== undefined || dto.isActive !== undefined)) {
      throw new ForbiddenException(
        'You cannot change your own role or activation status. ' +
        'Another SUPER_ADMIN or ADMIN must make this change.',
      );
    }

    // Privilege escalation check for role assignment
    if (dto.role !== undefined) {
      this.assertNoEscalation(actorRole, dto.role);
    }

    // Prevent demoting the last SUPER_ADMIN
    if (before.role === 'SUPER_ADMIN' && dto.role && dto.role !== 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', deletedAt: null, isActive: true },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last active SUPER_ADMIN. Promote another user first.',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        isActive: dto.isActive,
      },
      select: USER_SELECT,
    });

    // Emit a specific audit event if the role changed
    if (dto.role && dto.role !== before.role) {
      await this.auditLog.log({
        actorId,
        action: 'ROLE_CHANGE',
        resource: 'user',
        resourceId: id,
        before: { role: before.role },
        after: { role: updated.role },
      });
    }

    // Emit a general update event for any other field changes
    const profileChanged =
      dto.firstName !== undefined ||
      dto.lastName !== undefined ||
      dto.isActive !== undefined;

    if (profileChanged) {
      await this.auditLog.log({
        actorId,
        action: 'UPDATE',
        resource: 'user',
        resourceId: id,
        before: {
          firstName: before.firstName,
          lastName: before.lastName,
          isActive: before.isActive,
        },
        after: {
          firstName: updated.firstName,
          lastName: updated.lastName,
          isActive: updated.isActive,
        },
      });
    }

    return updated;
  }

  async assignRole(
    targetUserId: string,
    role: UserRole,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    if (targetUserId === actorId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const target = await this.findById(targetUserId, actorRole, actorCompanyId);
    this.assertNoEscalation(actorRole, role);

    // Prevent demoting last SUPER_ADMIN
    if (target.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      const count = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', deletedAt: null, isActive: true },
      });
      if (count <= 1) {
        throw new BadRequestException(
          'Cannot demote the last active SUPER_ADMIN. Promote another user first.',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: USER_SELECT,
    });

    await this.auditLog.log({
      actorId,
      action: 'ROLE_CHANGE',
      resource: 'user',
      resourceId: targetUserId,
      before: { role: target.role },
      after: { role: updated.role },
    });

    return updated;
  }

  async softDelete(
    id: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    // A user cannot delete themselves
    if (id === actorId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const target = await this.findById(id, actorRole, actorCompanyId);

    // Prevent deleting the last SUPER_ADMIN
    if (target.role === 'SUPER_ADMIN') {
      const count = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', deletedAt: null, isActive: true },
      });
      if (count <= 1) {
        throw new BadRequestException(
          'Cannot delete the last active SUPER_ADMIN.',
        );
      }
    }

    const deleted = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
      select: USER_SELECT,
    });

    // Revoke all active refresh tokens for the deleted user
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.auditLog.log({
      actorId,
      action: 'DELETE',
      resource: 'user',
      resourceId: id,
      before: { email: target.email, role: target.role, companyId: target.companyId },
    });

    return deleted;
  }
}
