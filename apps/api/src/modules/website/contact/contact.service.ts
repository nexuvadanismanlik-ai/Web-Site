import { Injectable, NotFoundException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';
import { EmailService } from '../../email/email.service';
import { LeadService } from './lead.service';
import {
  resolvePagination,
  paginated,
} from '../../../common/dto/pagination-query.dto';
import type { CreateContactMessageDto } from './dto/create-contact-message.dto';
import {
  MESSAGE_DEFAULT_SORT,
  MESSAGE_SORTABLE,
  type ListMessagesDto,
} from './dto/list-messages.dto';

/**
 * Submissions allowed from one IP within the rolling window. This only counts
 * distinct visitors once the app trusts the proxy's forwarded address — see
 * `resolveTrustProxy` in config/app.config.ts.
 */
const MAX_PER_IP = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Columns the list view actually renders. Request metadata is retained for
 * abuse investigation and read through the single-message endpoint, not shipped
 * with every row of every page.
 */
const MESSAGE_LIST_SELECT = {
  id: true,
  requestNo: true,
  name: true,
  email: true,
  phone: true,
  subject: true,
  message: true,
  company: true,
  service: true,
  budget: true,
  status: true,
  tags: true,
  isRead: true,
  readAt: true,
  createdAt: true,
  lastActionAt: true,
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

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
    private readonly leads: LeadService,
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

    // Honeypot: a field no real visitor sees. Filled means a bot, and the
    // submission is acknowledged without being stored — telling a bot it failed
    // only teaches it to try again differently.
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.warn(`Contact honeypot triggered from ip=${meta.ip ?? 'unknown'}`);
      return { id: 'ok', createdAt: new Date() };
    }

    const created = await this.prisma.contactMessage.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        subject: dto.subject?.trim() || null,
        message: dto.message.trim(),
        company: dto.company?.trim() || null,
        service: dto.service?.trim() || null,
        budget: dto.budget?.trim() || null,
        consentAt: dto.consent ? new Date() : null,
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
      },
      select: { id: true, createdAt: true },
    });

    // Timeline entry and team notification. Not awaited: the enquiry is stored,
    // and a failure to announce it must not turn into a failure to receive it.
    void this.leads.onLeadCreated(created.id, tenantId, dto.name.trim());

    // Announced, not awaited: the enquiry is already safely stored, and the
    // visitor should not wait on an outbound mail call — or see an error if it
    // fails. Failures are logged, never propagated.
    void this.announce(dto).catch((error: unknown) => {
      this.logger.error(
        `Contact notification failed for message ${created.id}: ${String(error)}`,
      );
    });

    // The public caller gets an acknowledgement only — never the stored row.
    // The envelope's `success` is added by TransformInterceptor.
    return { id: created.id, createdAt: created.createdAt };
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
    const paging = resolvePagination(query, {
      sortable: MESSAGE_SORTABLE,
      defaultSort: MESSAGE_DEFAULT_SORT,
    });

    const where = {
      tenantId,
      deletedAt: null,
      ...(query.isRead !== undefined ? { isRead: query.isRead === 'true' } : {}),
      ...(query.status ? { status: query.status } : {}),
      // "none" is how the UI asks for the leads nobody has picked up.
      ...(query.assignedTo
        ? { assignedToId: query.assignedTo === 'none' ? null : query.assignedTo }
        : {}),
      ...(paging.search
        ? {
            OR: [
              { name: { contains: paging.search, mode: 'insensitive' as const } },
              { email: { contains: paging.search, mode: 'insensitive' as const } },
              { subject: { contains: paging.search, mode: 'insensitive' as const } },
              { message: { contains: paging.search, mode: 'insensitive' as const } },
              { company: { contains: paging.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total, unread] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        orderBy: paging.orderBy,
        skip: paging.skip,
        take: paging.take,
        // The list view shows a sender and a preview. Message bodies, IP
        // addresses and user agents were being sent for every row of every
        // page to render a truncated subject line.
        select: MESSAGE_LIST_SELECT,
      }),
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.count({ where: { tenantId, deletedAt: null, isRead: false } }),
    ]);

    const page = paginated(items, total, paging);
    // `items` sits alongside the shared `data` field because the panel reads
    // it. Dropping it is a client change that belongs with the CRM work rather
    // than buried in a pagination commit; `unread` is genuinely extra, and the
    // panel was recomputing it in three places from a full download.
    return { ...page, items, meta: { ...page.meta, unread } };
  }

  async findOne(id: string, tenantSlug?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const message = await this.prisma.contactMessage.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!message) throw new NotFoundException(`Message "${id}" not found`);
    return message;
  }

  /**
   * Marks every unread enquiry read in one statement.
   *
   * The panel used to do this by sending one request per unread message, so an
   * inbox with forty unread items produced forty round trips through the whole
   * auth stack.
   */
  async markAllRead(tenantSlug?: string): Promise<{ updated: number }> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const result = await this.prisma.contactMessage.updateMany({
      where: { tenantId, deletedAt: null, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
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
