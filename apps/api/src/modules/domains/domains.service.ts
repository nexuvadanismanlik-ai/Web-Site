import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateDomainDto } from './dto/create-domain.dto';
import type { UpdateDomainDto } from './dto/update-domain.dto';
import type { UserRole } from '@nexuva/types';

// Full tenant ownership context needed for every ownership check.
const DOMAIN_WITH_OWNER = {
  tenant: {
    include: {
      company: { select: { id: true } },
      product: { select: { companyId: true } },
    },
  },
} as const;

type DomainWithOwner = Awaited<
  ReturnType<DomainsService['findById']>
>;

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ─── Ownership helpers ────────────────────────────────────────────────────

  /**
   * Derives the company that owns the given tenant.
   * A tenant is owned by a company either directly (it IS the company tenant)
   * or indirectly (it is a product tenant, and the product belongs to a company).
   */
  private resolveOwnerCompanyId(
    tenant: { company: { id: string } | null; product: { companyId: string } | null },
  ): string | null {
    return tenant.company?.id ?? tenant.product?.companyId ?? null;
  }

  private assertDomainOwnership(
    domain: DomainWithOwner,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ): void {
    if (actorRole === 'SUPER_ADMIN') return;

    const ownerCompanyId = this.resolveOwnerCompanyId(domain.tenant);

    if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
      throw new ForbiddenException('Access denied to this domain');
    }
  }

  /**
   * Verifies a tenantId belongs to the actor's company before it is used
   * in a create or reassignment operation.
   */
  private async assertTenantOwnership(
    tenantId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ): Promise<void> {
    if (actorRole === 'SUPER_ADMIN') return;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        company: { select: { id: true } },
        product: { select: { companyId: true } },
      },
    });

    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    const ownerCompanyId = this.resolveOwnerCompanyId(tenant);
    if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
      throw new ForbiddenException('You do not have permission to assign domains to this tenant');
    }
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  findAll(actorRole: UserRole, actorCompanyId?: string | null) {
    if (actorRole === 'SUPER_ADMIN') {
      return this.prisma.domain.findMany({
        include: {
          tenant: { select: { id: true, name: true, slug: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Non-SUPER_ADMIN: only see domains whose tenant belongs to their company,
    // either as the company's own tenant or as one of the company's product tenants.
    return this.prisma.domain.findMany({
      where: {
        tenant: {
          OR: [
            { company: { id: actorCompanyId ?? '__none__' } },
            { product: { companyId: actorCompanyId ?? '__none__' } },
          ],
        },
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(
    id: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const domain = await this.prisma.domain.findUnique({
      where: { id },
      include: DOMAIN_WITH_OWNER,
    });

    if (!domain) throw new NotFoundException(`Domain ${id} not found`);

    this.assertDomainOwnership(domain, actorRole, actorCompanyId);

    return domain;
  }

  async findByDomainName(
    domainName: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const domain = await this.prisma.domain.findUnique({
      where: { domainName },
      include: DOMAIN_WITH_OWNER,
    });

    if (!domain) throw new NotFoundException(`Domain "${domainName}" not found`);

    this.assertDomainOwnership(domain, actorRole, actorCompanyId);

    return domain;
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  async create(
    dto: CreateDomainDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    // Validate type + redirectTo consistency
    if (dto.type === 'REDIRECT' && !dto.redirectTo) {
      throw new BadRequestException('redirectTo is required when type is REDIRECT');
    }
    if (dto.type !== 'REDIRECT' && dto.redirectTo) {
      throw new BadRequestException('redirectTo is only valid when type is REDIRECT');
    }

    // Verify the caller owns the target tenant
    await this.assertTenantOwnership(dto.tenantId, actorRole, actorCompanyId);

    const existing = await this.prisma.domain.findUnique({
      where: { domainName: dto.domainName },
    });
    if (existing) {
      throw new ConflictException(`Domain "${dto.domainName}" is already registered`);
    }

    const domain = await this.prisma.domain.create({
      data: {
        domainName: dto.domainName,
        type: dto.type ?? 'PRIMARY',
        tenantId: dto.tenantId,
        redirectTo: dto.redirectTo ?? null,
        isActive: dto.isActive ?? true,
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    await this.auditLog.log({
      actorId,
      action: 'CREATE',
      resource: 'domain',
      resourceId: domain.id,
      after: {
        domainName: domain.domainName,
        type: domain.type,
        tenantId: domain.tenantId,
        redirectTo: domain.redirectTo,
        isActive: domain.isActive,
      },
    });

    return domain;
  }

  async update(
    id: string,
    dto: UpdateDomainDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    // Fetch and ownership-check the domain being modified
    const domain = await this.findById(id, actorRole, actorCompanyId);

    // tenantId reassignment is SUPER_ADMIN only
    if (dto.tenantId && dto.tenantId !== domain.tenantId && actorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can reassign a domain to a different tenant');
    }

    // If reassigning to a new tenant, verify SUPER_ADMIN owns the destination
    // (always true for SUPER_ADMIN, but we validate the tenant exists)
    if (dto.tenantId && dto.tenantId !== domain.tenantId) {
      await this.assertTenantOwnership(dto.tenantId, actorRole, actorCompanyId);
    }

    // Determine effective type for redirect validation
    const effectiveType = dto.type ?? domain.type;
    const effectiveRedirectTo = dto.redirectTo !== undefined ? dto.redirectTo : domain.redirectTo;

    if (effectiveType === 'REDIRECT' && !effectiveRedirectTo) {
      throw new BadRequestException('redirectTo is required when type is REDIRECT');
    }
    if (effectiveType !== 'REDIRECT' && effectiveRedirectTo) {
      throw new BadRequestException('redirectTo is only valid when type is REDIRECT');
    }

    const updated = await this.prisma.domain.update({
      where: { id },
      data: {
        type: dto.type,
        tenantId: dto.tenantId,
        redirectTo: effectiveType === 'REDIRECT' ? effectiveRedirectTo : null,
        isActive: dto.isActive,
      },
    });

    await this.auditLog.log({
      actorId,
      action: 'UPDATE',
      resource: 'domain',
      resourceId: id,
      before: {
        type: domain.type,
        tenantId: domain.tenantId,
        redirectTo: domain.redirectTo,
        isActive: domain.isActive,
      },
      after: {
        type: updated.type,
        tenantId: updated.tenantId,
        redirectTo: updated.redirectTo,
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  async remove(id: string, actorId: string) {
    // Hard delete — SUPER_ADMIN only. No cross-tenant check needed.
    const domain = await this.prisma.domain.findUnique({
      where: { id },
      include: { tenant: { select: { id: true, slug: true } } },
    });
    if (!domain) throw new NotFoundException(`Domain ${id} not found`);

    await this.prisma.domain.delete({ where: { id } });

    await this.auditLog.log({
      actorId,
      action: 'DELETE',
      resource: 'domain',
      resourceId: id,
      before: {
        domainName: domain.domainName,
        type: domain.type,
        tenantId: domain.tenantId,
        isActive: domain.isActive,
      },
    });

    return { deleted: true, id, domainName: domain.domainName };
  }
}
