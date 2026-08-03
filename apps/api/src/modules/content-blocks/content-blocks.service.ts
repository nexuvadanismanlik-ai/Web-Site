import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { ContentBlock, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { VersioningService } from '../versioning/versioning.service';
import type { CreateContentBlockDto } from './dto/create-content-block.dto';
import type { UpdateContentBlockDto } from './dto/update-content-block.dto';
import type { ReorderItemDto } from './dto/reorder-blocks.dto';
import type { UserRole } from '@nexuva/types';

// Maximum serialized size of a block's content payload (100 KB).
const MAX_CONTENT_BYTES = 100 * 1024;

// Resolves the ownership chain: Tenant → Company | Product.
const TENANT_OWNER_SELECT = {
  id: true,
  company: { select: { id: true } },
  product: { select: { companyId: true } },
} as const;

@Injectable()
export class ContentBlocksService {
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
   * Verifies the actor owns the page (via its tenant). SUPER_ADMIN bypasses.
   * Rejects missing or soft-deleted pages. Returns the page id + tenant id.
   */
  private async assertPageOwnership(
    pageId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ): Promise<{ id: string; tenantId: string }> {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: { id: true, tenantId: true, tenant: { select: TENANT_OWNER_SELECT } },
    });
    if (!page) throw new NotFoundException(`Page ${pageId} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      const ownerCompanyId = this.resolveOwnerCompanyId(page.tenant);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException(
          'You do not have permission to access content for this page',
        );
      }
    }

    return { id: page.id, tenantId: page.tenantId };
  }

  /**
   * Fetches a non-deleted block and verifies the actor owns its page's tenant.
   * Returns the block for the caller to reuse.
   */
  private async assertBlockOwnership(
    blockId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const block = await this.prisma.contentBlock.findFirst({
      where: { id: blockId, deletedAt: null },
      include: {
        page: {
          select: { id: true, tenantId: true, tenant: { select: TENANT_OWNER_SELECT } },
        },
      },
    });
    if (!block) throw new NotFoundException(`Content block ${blockId} not found`);

    if (actorRole !== 'SUPER_ADMIN') {
      const ownerCompanyId = this.resolveOwnerCompanyId(block.page.tenant);
      if (!ownerCompanyId || ownerCompanyId !== actorCompanyId) {
        throw new ForbiddenException('You do not have permission to access this content block');
      }
    }

    return block;
  }

  /**
   * Guards against empty or oversized content payloads.
   */
  private assertValidContent(content: Record<string, unknown>): void {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new BadRequestException('content must be a non-null JSON object');
    }
    if (Object.keys(content).length === 0) {
      throw new BadRequestException('content must not be an empty object');
    }
    const size = Buffer.byteLength(JSON.stringify(content), 'utf8');
    if (size > MAX_CONTENT_BYTES) {
      throw new BadRequestException(
        `content exceeds the maximum size of ${MAX_CONTENT_BYTES / 1024} KB`,
      );
    }
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  /**
   * Lists non-deleted blocks for a page (admin view — includes hidden blocks),
   * ordered by position. Ownership-checked.
   */
  async findByPage(pageId: string, actorRole: UserRole, actorCompanyId?: string | null) {
    await this.assertPageOwnership(pageId, actorRole, actorCompanyId);

    return this.prisma.contentBlock.findMany({
      where: { pageId, deletedAt: null },
      orderBy: { position: 'asc' },
    });
  }

  async findById(id: string, actorRole: UserRole, actorCompanyId?: string | null) {
    // Ownership check first; then return the clean block record without the
    // joined page/tenant ownership data.
    await this.assertBlockOwnership(id, actorRole, actorCompanyId);
    return this.prisma.contentBlock.findUnique({ where: { id } });
  }

  // ─── Mutation methods ─────────────────────────────────────────────────────

  async create(
    dto: CreateContentBlockDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertPageOwnership(dto.pageId, actorRole, actorCompanyId);
    this.assertValidContent(dto.content);

    // Determine position: use supplied value, else append after the current max.
    let position = dto.position;
    if (position === undefined) {
      const last = await this.prisma.contentBlock.findFirst({
        where: { pageId: dto.pageId, deletedAt: null },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = last ? last.position + 1 : 0;
    }

    const block = await this.prisma.contentBlock.create({
      data: {
        pageId: dto.pageId,
        type: dto.type as never,
        content: dto.content as Prisma.InputJsonValue,
        position,
        isVisible: dto.isVisible ?? true,
      },
    });

    await this.auditLog.log({
      actorId,
      action: 'CREATE',
      resource: 'content_block',
      resourceId: block.id,
      after: {
        pageId: block.pageId,
        type: block.type,
        position: block.position,
        isVisible: block.isVisible,
      },
    });

    return block;
  }

  /**
   * Updates block type and/or content. Snapshots the page state BEFORE the
   * mutation inside the same transaction so the pre-change state is preserved.
   */
  async update(
    id: string,
    dto: UpdateContentBlockDto,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.assertBlockOwnership(id, actorRole, actorCompanyId);

    if (dto.content !== undefined) {
      this.assertValidContent(dto.content);
    }

    // The update returns a bare row (no page/tenant include), so it is typed
    // against the model rather than the ownership-checked `before` shape.
    let updated: ContentBlock | null = null;

    await this.prisma.$transaction(async (tx) => {
      // Snapshot pre-mutation state so this change is reversible via rollback.
      await this.versioning.captureVersionInTx(tx, before.pageId, actorId);

      updated = await tx.contentBlock.update({
        where: { id },
        data: {
          ...(dto.type !== undefined && { type: dto.type as never }),
          ...(dto.content !== undefined && { content: dto.content as Prisma.InputJsonValue }),
        },
      });
    });

    await this.auditLog.log({
      actorId,
      action: 'UPDATE',
      resource: 'content_block',
      resourceId: id,
      before: { type: before.type, content: before.content },
      after: { type: updated!.type, content: updated!.content },
    });

    return updated!;
  }

  /**
   * Reorders blocks within a page. All supplied block ids must belong to the
   * page (and not be soft-deleted). Applied atomically with a version snapshot.
   */
  async reorder(
    pageId: string,
    items: ReorderItemDto[],
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    await this.assertPageOwnership(pageId, actorRole, actorCompanyId);

    const existing = await this.prisma.contentBlock.findMany({
      where: { pageId, deletedAt: null },
      select: { id: true, position: true },
    });
    const existingIds = new Set(existing.map((b) => b.id));

    // Every id in the payload must belong to this page.
    for (const item of items) {
      if (!existingIds.has(item.id)) {
        throw new BadRequestException(
          `Block ${item.id} does not belong to page ${pageId} or has been deleted`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Snapshot pre-reorder state first.
      await this.versioning.captureVersionInTx(tx, pageId, actorId);

      for (const item of items) {
        await tx.contentBlock.update({
          where: { id: item.id },
          data: { position: item.position },
        });
      }
    });

    await this.auditLog.log({
      actorId,
      action: 'REORDER',
      resource: 'content_block',
      resourceId: pageId,
      before: { positions: existing.map((b) => ({ id: b.id, position: b.position })) },
      after: { positions: items.map((b) => ({ id: b.id, position: b.position })) },
    });

    return this.prisma.contentBlock.findMany({
      where: { pageId, deletedAt: null },
      orderBy: { position: 'asc' },
    });
  }

  async updateVisibility(
    id: string,
    isVisible: boolean,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.assertBlockOwnership(id, actorRole, actorCompanyId);

    if (before.isVisible === isVisible) {
      return { id, isVisible, changed: false };
    }

    // The update returns a bare row (no page/tenant include), so it is typed
    // against the model rather than the ownership-checked `before` shape.
    let updated: ContentBlock | null = null;

    await this.prisma.$transaction(async (tx) => {
      // Snapshot pre-change state so visibility toggles are reversible.
      await this.versioning.captureVersionInTx(tx, before.pageId, actorId);

      updated = await tx.contentBlock.update({
        where: { id },
        data: { isVisible },
      });
    });

    await this.auditLog.log({
      actorId,
      action: 'VISIBILITY_CHANGE',
      resource: 'content_block',
      resourceId: id,
      before: { isVisible: before.isVisible },
      after: { isVisible: updated!.isVisible },
    });

    return { id, isVisible: updated!.isVisible, changed: true };
  }

  async softDelete(
    id: string,
    actorId: string,
    actorRole: UserRole,
    actorCompanyId?: string | null,
  ) {
    const before = await this.assertBlockOwnership(id, actorRole, actorCompanyId);

    const deleted = await this.prisma.contentBlock.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditLog.log({
      actorId,
      action: 'DELETE',
      resource: 'content_block',
      resourceId: id,
      before: {
        pageId: before.pageId,
        type: before.type,
        position: before.position,
        isVisible: before.isVisible,
      },
    });

    return { id: deleted.id, deleted: true };
  }
}
