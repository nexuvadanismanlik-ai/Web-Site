import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { LeadActivityType, LeadStatus, NotificationType, type Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';

/** Columns a lead list may be sorted by. */
export const LEAD_SORTABLE = ['createdAt', 'lastActionAt', 'name', 'status'] as const;
export const LEAD_DEFAULT_SORT = 'lastActionAt';

/** The pipeline, in order. */
export const LEAD_STATUSES = Object.values(LeadStatus);

/** Statuses that mean the lead is no longer being worked. */
const CLOSED: LeadStatus[] = [LeadStatus.WON, LeadStatus.LOST, LeadStatus.ARCHIVED];

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
    }

    return this.findOne(id, tenantSlug);
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
