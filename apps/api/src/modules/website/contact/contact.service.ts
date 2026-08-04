import { Injectable, NotFoundException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';
import { EmailService } from '../../email/email.service';
import type { CreateContactMessageDto } from './dto/create-contact-message.dto';
import type { ListMessagesDto } from './dto/list-messages.dto';

/**
 * Submissions allowed from one IP within the rolling window. This only counts
 * distinct visitors once the app trusts the proxy's forwarded address — see
 * `resolveTrustProxy` in config/app.config.ts.
 */
const MAX_PER_IP = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Everything here goes into an HTML email and is written by the public. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: WebsiteTenantService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
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

    // Announced, not awaited: the enquiry is already safely stored, and the
    // visitor should not wait on an outbound mail call — or see an error if it
    // fails. Failures are logged, never propagated.
    void this.announce(dto).catch((error: unknown) => {
      this.logger.error(
        `Contact notification failed for message ${created.id}: ${String(error)}`,
      );
    });

    // The public caller gets an acknowledgement only — never the stored row.
    return { success: true, id: created.id, createdAt: created.createdAt };
  }

  /**
   * Emails the team that a new enquiry arrived. Silently does nothing when no
   * recipient or no provider key is configured, so an unconfigured environment
   * still accepts enquiries rather than logging an error on every submission.
   */
  private async announce(dto: CreateContactMessageDto): Promise<void> {
    const to = this.config.get<string[]>('email.contactNotifyTo', []);
    if (to.length === 0) return;
    if (!this.config.get<string>('email.resendApiKey')) {
      this.logger.warn('Contact notification skipped: no email provider key configured');
      return;
    }

    const subject = dto.subject?.trim() || 'Konu belirtilmedi';
    const rows: [string, string][] = [
      ['Ad Soyad', dto.name.trim()],
      ['E-posta', dto.email.trim()],
      ['Telefon', dto.phone?.trim() || '—'],
      ['Konu', subject],
    ];

    await this.email.send({
      to,
      subject: `Yeni web sitesi talebi: ${subject}`,
      text: [
        ...rows.map(([label, value]) => `${label}: ${value}`),
        '',
        dto.message.trim(),
      ].join('\n'),
      html: [
        '<h2>Yeni web sitesi talebi</h2>',
        '<table cellpadding="6" style="border-collapse:collapse">',
        ...rows.map(
          ([label, value]) =>
            `<tr><td style="color:#666">${label}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`,
        ),
        '</table>',
        `<p style="white-space:pre-wrap">${escapeHtml(dto.message.trim())}</p>`,
      ].join(''),
    });
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
