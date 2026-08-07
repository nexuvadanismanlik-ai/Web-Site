import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { LeadActivityType, LeadStatus, NotificationType, type Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';
import { EmailService } from '../../email/email.service';
import {
  MailTemplateService,
  fillTemplate,
  renderEmailHtml,
} from '../../email/mail-template.service';

/** Columns a lead list may be sorted by. */
export const LEAD_SORTABLE = ['createdAt', 'lastActionAt', 'name', 'status'] as const;
export const LEAD_DEFAULT_SORT = 'lastActionAt';

/** The pipeline, in order. */
export const LEAD_STATUSES = Object.values(LeadStatus);


/** What each stage is called in a message to a person. */
const STATUS_TEXT: Record<string, string> = {
  NEW: 'Yeni',
  REVIEWING: 'İnceleniyor',
  CONTACTED: 'İletişime geçildi',
  PROPOSAL_SENT: 'Teklif gönderildi',
  MEETING: 'Görüşme',
  WAITING: 'Bekliyor',
  WON: 'Kazanıldı',
  LOST: 'Kaybedildi',
  ARCHIVED: 'Arşiv',
};

/** Statuses that mean the lead is no longer being worked. */
const CLOSED: LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST, LeadStatus.ARCHIVED];

/**
 * The two outcomes that deserve their own message rather than a generic
 * "your status changed". Archiving is deliberately absent: it is filing, and
 * nobody wants an email telling them they have been filed.
 */
const OUTCOME_TEMPLATES: Partial<Record<LeadStatus, string>> = {
  [LeadStatus.WON]: 'deal_won',
  [LeadStatus.LOST]: 'deal_lost',
};

const LEAD_LIST_SELECT = {
  id: true,
  requestNo: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  service: true,
  budget: true,
  subject: true,
  status: true,
  tags: true,
  isRead: true,
  createdAt: true,
  lastActionAt: true,
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

const LEAD_DETAIL_SELECT = {
  ...LEAD_LIST_SELECT,
  // Attribution is on the detail rather than the list: it is what somebody
  // wants when they open one enquiry, and thirty extra columns on every row of
  // a hundred-row page is a transfer nobody asked for.
  source: true,
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
  landingPath: true,
  referrer: true,
  device: true,
  message: true,
  consentAt: true,
  readAt: true,
  notes: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  activities: {
    orderBy: { createdAt: 'desc' as const },
    take: 100,
    select: {
      id: true,
      type: true,
      description: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  files: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    select: { id: true, url: true, filename: true, mimeType: true, size: true, createdAt: true },
  },
} as const;

/**
 * Enquiries, once they are being worked rather than merely received.
 *
 * Every change writes to the timeline, because "what happened to this lead"
 * must have an answer that does not depend on someone having remembered to
 * leave a note. The timeline is append-only.
 */
@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: WebsiteTenantService,
    private readonly email: EmailService,
    private readonly templates: MailTemplateService,
  ) {}

  /** How many leads sit in each stage, for the pipeline header. */
  async pipelineCounts(tenantSlug?: string): Promise<Record<string, number>> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const rows = await this.prisma.contactMessage.groupBy({
      by: ['status'],
      where: { tenantId, deletedAt: null },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const status of LEAD_STATUSES) counts[status] = 0;
    for (const row of rows) counts[row.status] = row._count._all;
    return counts;
  }

  /**
   * The numbers on the CRM overview.
   *
   * Counted by the database, not derived in the browser from a page of leads:
   * the list endpoint returns at most a hundred rows, so a summary computed
   * from it would be right until the hundred-and-first enquiry and quietly
   * wrong afterwards.
   */
  async summary(tenantSlug?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const base = { tenantId, deletedAt: null };
    const openWhere = { ...base, status: { notIn: CLOSED } };
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [open, unassigned, awaitingFirstTouch, thisWeek, won, lost] = await Promise.all([
      this.prisma.contactMessage.count({ where: openWhere }),
      this.prisma.contactMessage.count({ where: { ...openWhere, assignedToId: null } }),
      this.prisma.contactMessage.count({ where: { ...base, status: LeadStatus.NEW } }),
      this.prisma.contactMessage.count({ where: { ...base, createdAt: { gte: weekAgo } } }),
      this.prisma.contactMessage.count({ where: { ...base, status: LeadStatus.WON } }),
      this.prisma.contactMessage.count({ where: { ...base, status: LeadStatus.LOST } }),
    ]);

    // A win rate over no decisions is not zero, it is unknown. Null so the
    // screen can say so instead of reporting a 0% nobody earned.
    const decided = won + lost;
    const winRate = decided === 0 ? null : Math.round((won / decided) * 100);

    return { open, unassigned, awaitingFirstTouch, thisWeek, won, lost, winRate };
  }

  /**
   * Who a lead can be handed to.
   *
   * A separate, narrow read rather than opening GET /users to content editors:
   * assigning needs a name and an id, not a user record.
   */
  async assignees() {
    return this.prisma.user.findMany({
      where: { isActive: true, role: { in: ['SUPER_ADMIN', 'ADMIN', 'CONTENT_EDITOR'] } },
      orderBy: [{ firstName: 'asc' }, { email: 'asc' }],
      select: { id: true, firstName: true, lastName: true, email: true },
    });
  }

  /**
   * A lead entered by hand, from a phone call, an email or a meeting.
   *
   * Deliberately not the public submit path: that one is unauthenticated,
   * rate limited per visitor, and sends the sender an acknowledgement. None of
   * that belongs to someone typing up a call they just took — and an
   * acknowledgement mail to a person who never filled in a form is a mistake
   * the customer sees.
   *
   * The timeline says where it came from, because six months later "how did we
   * get this one" is a question with money attached.
   */
  async create(
    input: {
      name: string;
      email: string;
      phone?: string | undefined;
      company?: string | undefined;
      service?: string | undefined;
      budget?: string | undefined;
      subject?: string | undefined;
      message: string;
      status?: LeadStatus | undefined;
      assignedToId?: string | undefined;
      source?: string | undefined;
    },
    actorId: string,
    tenantSlug?: string,
  ) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);

    if (input.assignedToId) {
      const exists = await this.prisma.user.findFirst({
        where: { id: input.assignedToId, isActive: true },
        select: { id: true },
      });
      if (!exists) throw new BadRequestException('Atanacak kullanıcı bulunamadı');
    }

    const lead = await this.prisma.contactMessage.create({
      data: {
        tenantId,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        company: input.company ?? null,
        service: input.service ?? null,
        budget: input.budget ?? null,
        subject: input.subject ?? null,
        message: input.message,
        status: input.status ?? LeadStatus.NEW,
        assignedToId: input.assignedToId ?? null,
        // Somebody in the panel is looking at it as they type it, so it is not
        // waiting to be read the way a form submission is.
        isRead: true,
        readAt: new Date(),
        lastActionAt: new Date(),
      },
      select: { id: true, name: true },
    });

    const origin = input.source?.trim();
    await this.prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        actorId,
        type: LeadActivityType.CREATED,
        description: origin ? `Talep elle eklendi — ${origin}` : 'Talep elle eklendi',
      },
    });

    if (input.assignedToId && input.assignedToId !== actorId) {
      await this.notify(
        input.assignedToId,
        tenantId,
        NotificationType.INFO,
        `Sana atandı: ${lead.name}`,
        'Panelden eklenen bir talep sana atandı.',
        { leadId: lead.id } as Prisma.InputJsonValue,
      );
    }

    return this.findOne(lead.id, tenantSlug);
  }

  async findOne(id: string, tenantSlug?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const lead = await this.prisma.contactMessage.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: LEAD_DETAIL_SELECT,
    });
    if (!lead) throw new NotFoundException(`Talep "${id}" bulunamadı`);
    return lead;
  }

  /**
   * Moves a lead along the pipeline.
   *
   * Any stage may follow any other: real conversations do not respect a state
   * machine, and refusing a jump would only teach people to work around it.
   * What matters is that the move is recorded.
   */
  async setStatus(id: string, status: LeadStatus, actorId: string, tenantSlug?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const current = await this.prisma.contactMessage.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, status: true, name: true, assignedToId: true },
    });
    if (!current) throw new NotFoundException(`Talep "${id}" bulunamadı`);
    if (current.status === status) return this.findOne(id, tenantSlug);

    await this.prisma.$transaction([
      this.prisma.contactMessage.update({
        where: { id },
        data: { status, lastActionAt: new Date() },
      }),
      this.prisma.leadActivity.create({
        data: {
          leadId: id,
          actorId,
          type: LeadActivityType.STATUS_CHANGED,
          description: `Durum ${current.status} → ${status}`,
          metadata: { from: current.status, to: status },
        },
      }),
    ]);

    // The person carrying the lead should hear that it moved without them.
    if (current.assignedToId && current.assignedToId !== actorId) {
      await this.notify(
        current.assignedToId,
        tenantId,
        CLOSED.includes(status) ? NotificationType.INFO : NotificationType.INFO,
        `Talep durumu değişti: ${current.name}`,
        `${current.status} → ${status}`,
        { leadId: id },
      );
    }

    // And the customer hears about it, if that template has been turned on.
    // It ships disabled: somebody who is emailed every time an internal column
    // changes learns to ignore the emails that matter.
    void this.sendLeadTemplate(tenantId, 'status_changed', id, {
      durum: STATUS_TEXT[status] ?? status,
    });

    // Winning and losing are not "a status changed" — they are the two moments
    // a customer is actually owed a written word, so each has its own template
    // with something to say. Both respect the template's own enabled flag, and
    // the closing note ships off: sent to everyone who went quiet it reads as a
    // system giving up on them, which is a decision for a person to make.
    const outcome = OUTCOME_TEMPLATES[status];
    if (outcome) void this.sendLeadTemplate(tenantId, outcome, id, {});

    return this.findOne(id, tenantSlug);
  }

  /** Hands a lead to someone, or takes it back when userId is null. */
  async assign(id: string, userId: string | null, actorId: string, tenantSlug?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const current = await this.prisma.contactMessage.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, name: true, assignedToId: true },
    });
    if (!current) throw new NotFoundException(`Talep "${id}" bulunamadı`);

    if (userId) {
      const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!exists) throw new BadRequestException('Atanacak kullanıcı bulunamadı');
    }

    await this.prisma.$transaction([
      this.prisma.contactMessage.update({
        where: { id },
        data: { assignedToId: userId, lastActionAt: new Date() },
      }),
      this.prisma.leadActivity.create({
        data: {
          leadId: id,
          actorId,
          type: userId ? LeadActivityType.ASSIGNED : LeadActivityType.UNASSIGNED,
          description: userId ? 'Talep atandı' : 'Atama kaldırıldı',
          metadata: { from: current.assignedToId, to: userId },
        },
      }),
    ]);

    if (userId && userId !== actorId) {
      await this.notify(
        userId,
        tenantId,
        NotificationType.INFO,
        `Sana bir talep atandı: ${current.name}`,
        null,
        { leadId: id },
      );

      // A notification in the panel is only seen by somebody already in the
      // panel. The person who has just been handed a lead may not be.
      const assignee = await this.prisma.user
        .findUnique({ where: { id: userId }, select: { email: true } })
        .catch(() => null);
      if (assignee?.email) {
        void this.sendLeadTemplate(tenantId, 'lead_assigned', id, {}, assignee.email);
      }
    }

    return this.findOne(id, tenantSlug);
  }

  /**
   * Sends one of the CRM's templates about a specific lead.
   *
   * Best-effort throughout: the lead has already moved, and a mail provider
   * having a bad afternoon must not roll that back. Every attempt is written to
   * the mail log either way, so "did they get it" has an answer.
   *
   * Recipient defaults to the person who wrote in; pass one to send internally
   * instead.
   */
  private async sendLeadTemplate(
    tenantId: string,
    key: string,
    leadId: string,
    extra: Record<string, string>,
    to?: string,
  ): Promise<void> {
    try {
      const template = await this.templates.findByKey(tenantId, key).catch(() => null);
      if (!template || !template.enabled) return;

      const lead = await this.prisma.contactMessage.findUnique({
        where: { id: leadId },
        select: {
          name: true,
          email: true,
          phone: true,
          company: true,
          service: true,
          budget: true,
          message: true,
          requestNo: true,
          status: true,
        },
      });
      if (!lead) return;

      const brandRow = await this.prisma.websiteSection.findUnique({
        where: { tenantId_key: { tenantId, key: 'brand' } },
        select: { data: true },
      });
      const brand = (brandRow?.data ?? {}) as {
        siteName?: string;
        primaryColor?: string;
        logoUrl?: string;
      };

      const values: Record<string, string> = {
        ad: lead.name,
        firma: lead.company ?? '',
        eposta: lead.email,
        telefon: lead.phone ?? '',
        hizmet: lead.service ?? '',
        butce: lead.budget ?? '',
        talep_no: String(lead.requestNo),
        mesaj: lead.message,
        durum: STATUS_TEXT[lead.status] ?? lead.status,
        firma_adi: brand.siteName ?? 'Nexuva',
        site_adresi: '',
        ...extra,
      };

      await this.email.trySend({
        tenantId,
        to: to ?? lead.email,
        templateKey: key,
        subject: fillTemplate(template.subject, values),
        html: renderEmailHtml({
          body: fillTemplate(template.body, values),
          brandName: brand.siteName || 'Nexuva',
          brandColor: brand.primaryColor || '#6366f1',
          logoUrl: brand.logoUrl ?? null,
        }),
      });
    } catch (err) {
      this.logger.error(`Lead maili gönderilemedi (${key}): ${String(err)}`);
    }
  }

  async addNote(id: string, body: string, authorId: string, tenantSlug?: string) {
    const text = body.trim();
    if (!text) throw new BadRequestException('Not boş olamaz');

    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const lead = await this.prisma.contactMessage.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException(`Talep "${id}" bulunamadı`);

    await this.prisma.$transaction([
      this.prisma.leadNote.create({ data: { leadId: id, authorId, body: text } }),
      this.prisma.contactMessage.update({ where: { id }, data: { lastActionAt: new Date() } }),
      this.prisma.leadActivity.create({
        data: {
          leadId: id,
          actorId: authorId,
          type: LeadActivityType.NOTE_ADDED,
          description: text.length > 90 ? `${text.slice(0, 90)}…` : text,
        },
      }),
    ]);

    return this.findOne(id, tenantSlug);
  }

  async removeNote(noteId: string, actorId: string, tenantSlug?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const note = await this.prisma.leadNote.findFirst({
      where: { id: noteId, lead: { tenantId, deletedAt: null } },
      select: { id: true, leadId: true, authorId: true },
    });
    if (!note) throw new NotFoundException('Not bulunamadı');

    await this.prisma.leadNote.delete({ where: { id: noteId } });
    return this.findOne(note.leadId, tenantSlug);
  }

  /** Free-form labels. Replaced as a set, which is how the UI edits them. */
  async setTags(id: string, tags: string[], actorId: string, tenantSlug?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20);

    const updated = await this.prisma.contactMessage.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { tags: clean, lastActionAt: new Date() },
    });
    if (updated.count === 0) throw new NotFoundException(`Talep "${id}" bulunamadı`);

    await this.prisma.leadActivity.create({
      data: {
        leadId: id,
        actorId,
        type: LeadActivityType.UPDATED,
        description: clean.length ? `Etiketler: ${clean.join(', ')}` : 'Etiketler kaldırıldı',
      },
    });

    return this.findOne(id, tenantSlug);
  }

  /**
   * Records an arriving enquiry on the timeline and tells the team.
   *
   * Called by ContactService after the row is written, and deliberately
   * tolerant: a lead that arrived must not be lost because its notification
   * could not be delivered.
   */
  async onLeadCreated(leadId: string, tenantId: string, name: string): Promise<void> {
    try {
      await this.prisma.leadActivity.create({
        data: {
          leadId,
          type: LeadActivityType.CREATED,
          description: 'Talep web sitesinden geldi',
        },
      });

      // Everyone who can work a lead hears about a new one. There is no
      // per-user preference yet; when there is, it filters this list.
      const recipients = await this.prisma.user.findMany({
        where: { isActive: true, role: { in: ['SUPER_ADMIN', 'ADMIN', 'CONTENT_EDITOR'] } },
        select: { id: true },
      });

      await this.prisma.notification.createMany({
        data: recipients.map((user) => ({
          userId: user.id,
          tenantId,
          type: NotificationType.INFO,
          title: `Yeni talep: ${name}`,
          body: 'Web sitesindeki iletişim formundan geldi.',
          metadata: { leadId } as Prisma.InputJsonValue,
        })),
      });
    } catch (err) {
      this.logger.error(`Lead ${leadId} bildirimi yazılamadı: ${String(err)}`);
    }
  }

  private async notify(
    userId: string,
    tenantId: string,
    type: NotificationType,
    title: string,
    body: string | null,
    metadata: Prisma.InputJsonValue,
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: { userId, tenantId, type, title, body, metadata },
      });
    } catch (err) {
      // A notification is a courtesy; the action it describes already happened.
      this.logger.error(`Bildirim oluşturulamadı: ${String(err)}`);
    }
  }
}
