import { Injectable, NotFoundException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';
import { EmailService } from '../../email/email.service';
import { MailSettingsService } from '../../email/mail-settings.service';
import {
  MailTemplateService,
  fillTemplate,
  renderEmailHtml,
} from '../../email/mail-template.service';
import { LeadService } from './lead.service';
import { classifyDevice, classifySource as classifyReferrer } from '../../analytics/analytics.service';
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

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: WebsiteTenantService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly leads: LeadService,
    private readonly mailSettings: MailSettingsService,
    private readonly templates: MailTemplateService,
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
        // Attribution, so a campaign can be followed to a won deal rather than
        // stopping at the visit that produced the enquiry.
        source: dto.utmSource?.trim() || classifyReferrer(dto.referrer),
        utmSource: dto.utmSource?.trim() || null,
        utmMedium: dto.utmMedium?.trim() || null,
        utmCampaign: dto.utmCampaign?.trim() || null,
        landingPath: dto.landingPath?.trim() || null,
        referrer: dto.referrer?.trim() || null,
        device: classifyDevice(meta.userAgent ?? ''),
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
    void this.announce(dto, tenantId, created.id).catch((error: unknown) => {
      this.logger.error(
        `Contact notification failed for message ${created.id}: ${String(error)}`,
      );
    });

    // The public caller gets an acknowledgement only — never the stored row.
    // The envelope's `success` is added by TransformInterceptor.
    return { id: created.id, createdAt: created.createdAt };
  }

  /**
   * The two messages a new enquiry produces.
   *
   * One to the team, so somebody knows. One to the person who wrote in, because
   * silence after filling in a form reads as the form being broken — and that
   * acknowledgement is the company's first written reply, which is why its
   * words live in an editable template rather than here.
   *
   * Both are best-effort: the enquiry is already stored, and a mail provider
   * having a bad afternoon must not turn into a lost lead. Every attempt is
   * recorded in the mail log either way, so "did they get it" has an answer.
   */
  private async announce(
    dto: CreateContactMessageDto,
    tenantId: string,
    leadId: string,
  ): Promise<void> {
    const [settings, lead] = await Promise.all([
      this.mailSettings.resolve(tenantId),
      this.prisma.contactMessage.findUnique({
        where: { id: leadId },
        select: { requestNo: true },
      }),
    ]);

    const values = {
      ad: dto.name.trim(),
      firma: dto.company?.trim() ?? '',
      eposta: dto.email.trim(),
      telefon: dto.phone?.trim() ?? '',
      hizmet: dto.service?.trim() || dto.subject?.trim() || 'Belirtilmedi',
      butce: dto.budget?.trim() ?? '',
      talep_no: String(lead?.requestNo ?? ''),
      mesaj: dto.message.trim(),
      firma_adi: settings.fromName,
      site_adresi: '',
    };

    // ── The team ────────────────────────────────────────────────────────────
    if (settings.notifyTo.length > 0) {
      await this.sendTemplate(tenantId, 'lead_notify', settings.notifyTo, values);
    } else {
      this.logger.warn(
        'Yeni talep bildirimi gönderilmedi: bildirim adresi tanımlı değil (Panel → Mail).',
      );
    }

    // ── The person who wrote in ─────────────────────────────────────────────
    await this.sendTemplate(tenantId, 'lead_received', [dto.email.trim()], values);
  }

  /** Renders one template through the shared shell and sends it. */
  private async sendTemplate(
    tenantId: string,
    key: string,
    to: string[],
    values: Record<string, string>,
  ): Promise<void> {
    const template = await this.templates.findByKey(tenantId, key).catch(() => null);
    if (!template || !template.enabled) return;

    const brandRow = await this.prisma.websiteSection.findUnique({
      where: { tenantId_key: { tenantId, key: 'brand' } },
      select: { data: true },
    });
    const brand = (brandRow?.data ?? {}) as {
      siteName?: string;
      primaryColor?: string;
      logoUrl?: string;
    };

    await this.email.trySend({
      tenantId,
      to,
      templateKey: key,
      subject: fillTemplate(template.subject, values),
      html: renderEmailHtml({
        body: fillTemplate(template.body, values),
        brandName: brand.siteName || values['firma_adi'] || 'Nexuva',
        brandColor: brand.primaryColor || '#6366f1',
        logoUrl: brand.logoUrl ?? null,
      }),
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
