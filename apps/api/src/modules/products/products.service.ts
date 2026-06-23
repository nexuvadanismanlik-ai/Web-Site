import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { UserRole } from '@nexuva/types';

const PRODUCT_LIST_INCLUDE = {
  company: { select: { id: true, name: true, type: true } },
  tenant: {
    select: {
      id: true,
      slug: true,
      branding: { select: { logoUrl: true, primaryColor: true } },
      domains: { where: { isActive: true, type: 'PRIMARY' as const }, select: { domainName: true } },
    },
  },
} as const;

const PRODUCT_DETAIL_INCLUDE = {
  company: true,
  tenant: {
    include: {
      branding: true,
      domains: true,
      featureFlags: true,
      settings: { where: { isPublic: true } },
    },
  },
} as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  findAll(actorRole: UserRole, actorCompanyId?: string | null) {
    const where =
      actorRole === 'SUPER_ADMIN'
        ? { deletedAt: null }
        : { deletedAt: null, companyId: actorCompanyId ?? '__none__' };

    return this.prisma.product.findMany({
      where,
      include: PRODUCT_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, actorRole: UserRole, actorCompanyId?: string | null) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_DETAIL_INCLUDE,
    });

    if (!product) throw new NotFoundException(`Product ${id} not found`);

    if (actorRole !== 'SUPER_ADMIN' && product.companyId !== actorCompanyId) {
      throw new ForbiddenException('Access denied to this product');
    }

    return product;
  }

  async create(dto: CreateProductDto, actorId: string) {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        status: dto.status ?? 'DRAFT',
        companyId: dto.companyId,
        tenant: {
          create: {
            slug: dto.slug,
            type: 'PRODUCT',
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
      resource: 'product',
      resourceId: product.id,
      after: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        status: product.status,
        companyId: product.companyId,
        tenantId: product.tenant.id,
      },
    });

    return product;
  }

  async updateStatus(
    id: string,
    status: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.findById(id, actorRole, actorCompanyId);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: status as never },
    });

    await this.auditLog.log({
      actorId,
      action: 'UPDATE_STATUS',
      resource: 'product',
      resourceId: id,
      before: { status: before.status },
      after: { status: updated.status },
    });

    return updated;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.findById(id, actorRole, actorCompanyId);

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
      },
    });

    await this.auditLog.log({
      actorId,
      action: 'UPDATE',
      resource: 'product',
      resourceId: id,
      before: { name: before.name, description: before.description, status: before.status },
      after: { name: updated.name, description: updated.description, status: updated.status },
    });

    return updated;
  }

  async softDelete(id: string, actorId: string) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    const deleted = await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });

    await this.auditLog.log({
      actorId,
      action: 'DELETE',
      resource: 'product',
      resourceId: id,
      before: { name: product.name, slug: product.slug, status: product.status },
    });

    return deleted;
  }
}
