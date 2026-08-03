import { Injectable, NotFoundException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';
import type { CreateContactMessageDto } from './dto/create-contact-message.dto';
import type { ListMessagesDto } from './dto/list-messages.dto';

/** Submissions allowed from one IP within the rolling window. */
const MAX_PER_IP = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: WebsiteTenantService,
  ) {}

  // ─── Public submission ────────────────────────────────────────────────────

  /**
   * Stores a contact form submission. This endpoint is unauthenticated, so it
   * enforces a per-IP rate cap on top of the global limiter and records request
   * metadata for abuse investigation.
   */
  async submit(
    dto: CreateContactMessageDto,
    meta: { ip?: string; userAgent?: string },
    tenantSlug?: string,
  ) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);

    if (meta.ip) {
      const recent = await this.prisma.contactMessage.count({
        where: {
          tenantId,
          ipAddress: meta.ip,
          createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
        },
      });
      if (recent >= MAX_PER_IP) {
        this.logger.warn(`Contact form rate limit hit for ip=${meta.ip} tenant=${tenantId}`);
        throw new HttpException(
          'Too many messages sent from this address. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const created = await this.prisma.contactMessage.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        subject: dto.subject?.trim() || null,
        message: dto.message.trim(),
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
      },
      select: { id: true, createdAt: true },
    });

    // The public caller gets an acknowledgement only — never the stored row.
    return { success: true, id: created.id, createdAt: created.createdAt };
  }

  // ─── Admin management ─────────────────────────────────────────────────────

  async list(query: ListMessagesDto, tenantSlug?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where = {
      tenantId,
      deletedAt: null,
      ...(query.isRead !== undefined ? { isRead: query.isRead === 'true' } : {}),
    };

    const [items, total, unread] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.count({ where: { tenantId, deletedAt: null, isRead: false } }),
    ]);

    return {
      items,
      meta: { page, limit, total, unread, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, tenantSlug?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const message = await this.prisma.contactMessage.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!message) throw new NotFoundException(`Message "${id}" not found`);
    return message;
  }

  async setRead(id: string, isRead: boolean, tenantSlug?: string) {
    await this.findOne(id, tenantSlug);
    return this.prisma.contactMessage.update({
      where: { id },
      data: { isRead, readAt: isRead ? new Date() : null },
    });
  }

  async remove(id: string, tenantSlug?: string) {
    await this.findOne(id, tenantSlug);
    return this.prisma.contactMessage.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
