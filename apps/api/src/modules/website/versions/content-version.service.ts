import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SiteContent } from '@nexuva/types';
import { PrismaService } from '../../../prisma/prisma.service';
import { fromJson, toJson } from '../../../common/json';
import { WebsiteTenantService } from '../website-tenant.service';
import { SiteContentService } from '../site-content/site-content.service';
import { SECTION_KEYS } from '../site-content/collections';
import {
  WEBSITE_COLLECTIONS,
  WEBSITE_COLLECTION_KEYS,
  type WebsiteCollectionKey,
} from '@nexuva/shared';

/** Structural view of the delegates a restore writes through. */
interface RestoreDelegate {
  deleteMany(args: unknown): Prisma.PrismaPromise<unknown>;
  create(args: unknown): Prisma.PrismaPromise<unknown>;
}

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
 * How a snapshot entry becomes a database row again.
 *
 * Restoring is the inverse of assembling: getSiteContent projects rows into the
 * shape the site consumes, dropping the columns the site does not need, so a
 * restore has to put them back. Which document key belongs to which collection
 * is not repeated here — it comes from the shared registry.
 */
const TO_ROW: Record<
  WebsiteCollectionKey,
  (item: unknown, index: number) => Record<string, unknown>
> = {
  nav: (item, i) => ({ ...(item as object), position: i, isActive: true }),
  // Logos are plain strings in the document.
  logos: (item, i) => ({ name: String(item), position: i, isActive: true }),
  services: stripId,
  stats: stripId,
  references: stripId,
  testimonials: stripId,
  process: stripId,
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
    return fromJson<SiteContent>(version.snapshot);
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

    const snapshot = fromJson<SiteContent>(source.snapshot);
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
    // The document is indexed by key here rather than by property, so it is
    // read as a plain record. Every key comes from the shared registry.
    const document: Record<string, unknown> = { ...snapshot };

    const sectionOps = SECTION_KEYS.filter((key) => document[key] !== undefined).map((key) => {
      const data = toJson(document[key]);
      return this.prisma.websiteSection.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: { tenantId, key, data },
        update: { data },
      });
    });

    const collectionOps: Prisma.PrismaPromise<unknown>[] = [];
    for (const key of WEBSITE_COLLECTION_KEYS) {
      const items = document[key];
      if (!Array.isArray(items)) continue;

      // The generated delegates have model-specific argument types, so the
      // registry lookup is cast once to the structural subset used here.
      // eslint-disable-next-line no-restricted-syntax -- one cast per registry lookup, not per call
      const delegate = this.prisma[WEBSITE_COLLECTIONS[key].model] as unknown as RestoreDelegate;
      const toRow = TO_ROW[key];

      // A restore replaces the collection wholesale, so unlike an ordinary save
      // there is nothing to reconcile against — the incoming rows carry the ids
      // of a past state, not of the rows standing now.
      collectionOps.push(delegate.deleteMany({ where: { tenantId } }));
      items.forEach((item, index) => {
        collectionOps.push(delegate.create({ data: { ...toRow(item, index), tenantId } }));
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
          snapshot: toJson(snapshot),
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
