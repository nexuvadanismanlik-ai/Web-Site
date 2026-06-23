import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateCompanyDto } from './dto/create-company.dto';
import type { UpdateCompanyDto } from './dto/update-company.dto';
import type { UserRole } from '@nexuva/types';

const COMPANY_INCLUDE = {
  subsidiaries: { where: { deletedAt: null as Date | null } },
  parent: true,
  products: { where: { deletedAt: null as Date | null } },
  tenant: { include: { branding: true, domains: { where: { isActive: true } } } },
} as const;

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll(actorRole: UserRole, actorCompanyId?: string | null) {
    if (actorRole === 'SUPER_ADMIN') {
      return this.prisma.company.findMany({
        where: { deletedAt: null },
        include: { subsidiaries: { where: { deletedAt: null } }, tenant: { select: { id: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!actorCompanyId) return Promise.resolve([]);

    return this.prisma.company.findMany({
      where: {
        deletedAt: null,
        OR: [{ id: actorCompanyId }, { parentId: actorCompanyId }],
      },
      include: { subsidiaries: { where: { deletedAt: null } }, tenant: { select: { id: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, actorRole: UserRole, actorCompanyId?: string | null) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: COMPANY_INCLUDE,
    });

    if (!company) throw new NotFoundException(`Company ${id} not found`);

    if (
      actorRole !== 'SUPER_ADMIN' &&
      actorCompanyId !== id &&
      company.parentId !== actorCompanyId
    ) {
      throw new ForbiddenException('Access denied to this company');
    }

    return company;
  }

  async create(dto: CreateCompanyDto, actorId: string) {
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        type: dto.type,
        legalName: dto.legalName ?? null,
        taxId: dto.taxId ?? null,
        description: dto.description ?? null,
        parentId: dto.parentId ?? null,
        tenant: {
          create: {
            slug: dto.slug,
            type: dto.type === 'HOLDING' ? 'HOLDING' : 'PRODUCT',
            name: dto.name,
            description: dto.description ?? null,
          },
        },
      },
      include: { tenant: { select: { id: true, slug: true } } },
    });

    await this.auditLog.log({
      actorId,
      action: 'CREATE',
      resource: 'company',
      resourceId: company.id,
      after: { id: company.id, name: company.name, type: company.type, slug: dto.slug },
    });

    return company;
  }

  async update(
    id: string,
    dto: UpdateCompanyDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.findById(id, actorRole, actorCompanyId);

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        legalName: dto.legalName,
        taxId: dto.taxId,
        description: dto.description,
        parentId: dto.parentId,
      },
    });

    await this.auditLog.log({
      actorId,
      action: 'UPDATE',
      resource: 'company',
      resourceId: id,
      before: { name: before.name, legalName: before.legalName, taxId: before.taxId, description: before.description, parentId: before.parentId },
      after: { name: updated.name, legalName: updated.legalName, taxId: updated.taxId, description: updated.description, parentId: updated.parentId },
    });

    return updated;
  }

  async softDelete(id: string, actorId: string) {
    const company = await this.prisma.company.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException(`Company ${id} not found`);

    const deleted = await this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLog.log({
      actorId,
      action: 'DELETE',
      resource: 'company',
      resourceId: id,
      before: { name: company.name, type: company.type },
    });

    return deleted;
  }
}
