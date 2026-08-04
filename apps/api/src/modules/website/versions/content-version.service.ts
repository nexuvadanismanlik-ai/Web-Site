import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SiteContent } from '@nexuva/types';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';
import { SiteContentService } from '../site-content/site-content.service';
import { COLLECTION_DEFS, SECTION_KEYS, type CollectionSlug } from '../site-content/collections';

/** One entry in the version history, without the snapshot body. */
export interface VersionSummary {
  id: string;
  number: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  note: string | null;
  restoredFrom: number | null;
}

/** How many versions the history endpoint returns by default. */
const DEFAULT_HISTORY_LIMIT = 20;

/**
 * Which SiteContent key each collection maps to, and how a snapshot row is
 * turned back into a database row.
 *
 * Restoring is the inverse of assembling: getSiteContent projects rows into the
 * shape the site consumes, dropping the columns the site does not need, so a
 * restore has to put them back.
 */
const RESTORE_MAP: Record<
  CollectionSlug,
  { key: keyof SiteContent; toRow: (item: unknown, index: number) => Record<string, unknown> }
> = {
  'nav-items': {
    key: 'nav',
    toRow: (item, i) => ({ ...(item as object), position: i, isActive: true }),
  },
  logos: {
    // Logos are plain strings in the document.
    key: 'logos',
    toRow: (item, i) => ({ name: String(item), position: i, isActive: true }),
  },
  services: { key: 'services', toRow: (item, i) => stripId(item, i) },
  stats: { key: 'stats', toRow: (item, i) => stripId(item, i) },
  references: { key: 'references', toRow: (item, i) => stripId(item, i) },
  testimonials: { key: 'testimonials', toRow: (item, i) => stripId(item, i) },
  'process-steps': { key: 'process', toRow: (item, i) => stripId(item, i) },
};

/**
 * A snapshot carries the ids the rows had when it was taken. Restoring creates
 * fresh rows rather than resurrecting those ids: the originals may still exist
 * with different content, and reusing an id would silently rewrite whatever is
 * standing there now.
 */
function stripId(item: unknown, index: number): Record<string, unknown> {
  const row = { ...(item as Record<string, unknown>) };
  delete row['id'];
  return { ...row, position: index, isActive: true };
}

/**
 * The published history of the site's content.
 *
 * The website tables are the draft. Publishing copies the whole document into a
 * version row, and the public site is served from the version marked published.
 * That separation is what lets an editor save without the site changing, and it
 * makes rolling back exact — the snapshot is literally what visitors were
 * served, not a reconstruction of it.
 */
@Injectable()
export class ContentVersionService {
  private readonly logger = new Logger(ContentVersionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: WebsiteTenantService,
    private readonly content: SiteContentService,
  ) {}

  /**
   * Freezes the current draft as a new version and makes it the published one.
   *
   * Called by the publish flow before the deploy is triggered, so what the
   * build fetches is exactly what was captured.
   */
  async publishDraft(
    actorId: string | null,
    note: string | null,
    tenantSlug?: string,
  ): Promise<VersionSummary> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const snapshot = await this.content.getSiteContent(tenantSlug);

    return this.commit(tenantId, snapshot, { actorId, note, restoredFrom: null });
  }

  /** History, newest first. Snapshots are omitted — they are large. */
  async list(tenantSlug?: string, limit = DEFAULT_HISTORY_LIMIT): Promise<VersionSummary[]> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const rows = await this.prisma.contentVersion.findMany({
      where: { tenantId },
      orderBy: { number: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        number: true,
        isPublished: true,
        publishedAt: true,
        createdAt: true,
        note: true,
        restoredFrom: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    return rows.map((row) => toSummary(row));
  }

  /** The full document of one version, for preview and comparison. */
  async getSnapshot(number: number, tenantSlug?: string): Promise<SiteContent> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const version = await this.prisma.contentVersion.findUnique({
      where: { tenantId_number: { tenantId, number } },
      select: { snapshot: true },
    });
    if (!version) throw new NotFoundException(`Version ${number} not found`);
    return version.snapshot as unknown as SiteContent;
  }

  /**
   * Restores an earlier version.
   *
   * The snapshot is written back into the working tables and then published as
   * a new version, rather than simply re-pointing at the old row. Two reasons:
   * the draft and the live site stay in agreement, which is what someone
   * pressing "geri al" expects; and the history stays append-only, so the
   * rollback itself is a recorded event that can in turn be undone.
   */
  async restore(
    number: number,
    actorId: string | null,
    tenantSlug?: string,
  ): Promise<VersionSummary> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const source = await this.prisma.contentVersion.findUnique({
      where: { tenantId_number: { tenantId, number } },
    });
    if (!source) throw new NotFoundException(`Version ${number} not found`);

    const snapshot = source.snapshot as unknown as SiteContent;
    if (!snapshot || typeof snapshot !== 'object') {
      throw new BadRequestException(`Version ${number} holds no usable content`);
    }

    await this.writeDraft(tenantId, snapshot);

    return this.commit(tenantId, snapshot, {
      actorId,
      note: `Sürüm ${number} geri yüklendi`,
      restoredFrom: number,
    });
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  /** Writes a snapshot over the working tables. */
  private async writeDraft(tenantId: string, snapshot: SiteContent): Promise<void> {
    const document = snapshot as unknown as Record<string, unknown>;

    const sectionOps = SECTION_KEYS.filter((key) => document[key] !== undefined).map((key) => {
      const data = document[key] as Prisma.InputJsonValue;
      return this.prisma.websiteSection.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: { tenantId, key, data },
        update: { data },
      });
    });

    const collectionOps: Prisma.PrismaPromise<unknown>[] = [];
    for (const slug of Object.keys(COLLECTION_DEFS) as CollectionSlug[]) {
      const map = RESTORE_MAP[slug];
      const items = document[map.key as string];
      if (!Array.isArray(items)) continue;

      const delegate = this.prisma[COLLECTION_DEFS[slug].model] as unknown as {
        deleteMany(args: unknown): Prisma.PrismaPromise<unknown>;
        create(args: unknown): Prisma.PrismaPromise<unknown>;
      };

      // A restore replaces the collection wholesale, so unlike an ordinary save
      // there is nothing to reconcile against — the incoming rows carry the ids
      // of a past state, not of the rows standing now.
      collectionOps.push(delegate.deleteMany({ where: { tenantId } }));
      items.forEach((item, index) => {
        collectionOps.push(delegate.create({ data: { ...map.toRow(item, index), tenantId } }));
      });
    }

    await this.prisma.$transaction([...sectionOps, ...collectionOps] as never);
  }

  /** Appends a version and moves the published marker onto it. */
  private async commit(
    tenantId: string,
    snapshot: SiteContent,
    meta: { actorId: string | null; note: string | null; restoredFrom: number | null },
  ): Promise<VersionSummary> {
    const latest = await this.prisma.contentVersion.findFirst({
      where: { tenantId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const number = (latest?.number ?? 0) + 1;
    const now = new Date();

    const [, created] = await this.prisma.$transaction([
      this.prisma.contentVersion.updateMany({
        where: { tenantId, isPublished: true },
        data: { isPublished: false },
      }),
      this.prisma.contentVersion.create({
        data: {
          tenantId,
          number,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          isPublished: true,
          publishedAt: now,
          createdById: meta.actorId,
          note: meta.note,
          restoredFrom: meta.restoredFrom,
        },
        select: {
          id: true,
          number: true,
          isPublished: true,
          publishedAt: true,
          createdAt: true,
          note: true,
          restoredFrom: true,
          createdBy: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    this.logger.log(`Published content version ${number} for tenant ${tenantId}`);
    return toSummary(created);
  }
}

function toSummary(row: {
  id: string;
  number: number;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  note: string | null;
  restoredFrom: number | null;
  createdBy?: { firstName: string | null; lastName: string | null; email: string } | null;
}): VersionSummary {
  const name = row.createdBy
    ? [row.createdBy.firstName, row.createdBy.lastName].filter(Boolean).join(' ') ||
      row.createdBy.email
    : null;

  return {
    id: row.id,
    number: row.number,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    createdBy: name,
    note: row.note,
    restoredFrom: row.restoredFrom,
  };
}
