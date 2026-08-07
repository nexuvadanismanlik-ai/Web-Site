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
 * How many differences are listed before the rest are counted instead.
 *
 * A first publish differs from nothing in every field of the site; rendering
 * eight hundred rows helps nobody and the count is the honest summary.
 */
const MAX_DIFF_ENTRIES = 60;

/** What kind of change happened to one field. */
export type ChangeKind = 'added' | 'removed' | 'changed';

export interface ContentChange {
  /** Where it is, in the panel's words: "Hero → Başlık". */
  label: string;
  /** The raw path, for anything that needs to be precise. */
  path: string[];
  kind: ChangeKind;
  /** Trimmed for display; a whole About page is not a diff line. */
  before: string | null;
  after: string | null;
}

export interface ContentDiff {
  from: number;
  to: number | null;
  changes: ContentChange[];
  truncated: boolean;
  total: number;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Section and collection keys as the panel names them. */
const DIFF_LABELS: Record<string, string> = {
  brand: 'Marka',
  hero: 'Hero',
  about: 'Hakkımızda',
  cta: 'CTA',
  contact: 'İletişim',
  footer: 'Alt Bilgi',
  seo: 'SEO',
  uiText: 'Arayüz Metinleri',
  integrations: 'Entegrasyonlar',
  servicesMeta: 'Hizmetler başlığı',
  referencesMeta: 'Referanslar başlığı',
  testimonialsMeta: 'Yorumlar başlığı',
  processMeta: 'Süreç başlığı',
  nav: 'Menü',
  logos: 'Logolar',
  services: 'Hizmetler',
  stats: 'Sayılar',
  references: 'Referanslar',
  testimonials: 'Yorumlar',
  process: 'Süreç',
  title: 'Başlık',
  subtitle: 'Alt başlık',
  description: 'Açıklama',
  image: 'Görsel',
  imageUrl: 'Görsel',
  logoUrl: 'Logo',
  name: 'Ad',
  label: 'Etiket',
  href: 'Bağlantı',
  body: 'Metin',
};

/**
 * Walks two documents together and records where they disagree.
 *
 * Recursive rather than a line-based text diff: the panel edits fields, so the
 * useful answer is "Hero → Başlık changed", not "line 412 changed". Arrays are
 * compared by position, which is right for the ordered collections the CMS
 * actually has — reordering a list reports as several changed items, which is
 * true, if blunter than it could be.
 */
function walk(before: Json, after: Json, path: string[], out: ContentChange[]): void {
  if (out.length > MAX_DIFF_ENTRIES * 4) return; // Cheap runaway guard.

  if (before === after) return;

  const bothObjects =
    isPlainObject(before) && isPlainObject(after);
  const bothArrays = Array.isArray(before) && Array.isArray(after);

  if (bothObjects) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      walk(before[key] ?? null, after[key] ?? null, [...path, key], out);
    }
    return;
  }

  if (bothArrays) {
    const length = Math.max(before.length, after.length);
    for (let i = 0; i < length; i++) {
      walk(before[i] ?? null, after[i] ?? null, [...path, String(i + 1)], out);
    }
    return;
  }

  const beforeText = display(before);
  const afterText = display(after);
  if (beforeText === afterText) return;

  out.push({
    label: labelFor(path),
    path,
    kind: isEmpty(before) ? 'added' : isEmpty(after) ? 'removed' : 'changed',
    before: isEmpty(before) ? null : beforeText,
    after: isEmpty(after) ? null : afterText,
  });
}

function isPlainObject(value: Json): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Absent, null and empty string all mean "there was nothing here". */
function isEmpty(value: Json): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * A path as somebody would read it.
 *
 * `tr`/`en` are dropped: the site is Turkish, and "Hero → Başlık → tr" is
 * noise. Numbers keep their position so two changed services are two lines.
 */
function labelFor(path: string[]): string {
  const parts = path
    .filter((segment) => segment !== 'tr' && segment !== 'en')
    .map((segment) => DIFF_LABELS[segment] ?? segment);
  return parts.join(' → ');
}

/** A value as one short line. */
function display(value: Json): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.length > 160 ? `${value.slice(0, 160)}…` : value;
  if (typeof value === 'boolean') return value ? 'açık' : 'kapalı';
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value).slice(0, 160);
}

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
   * What changed between two versions.
   *
   * The history could say who published and when, but not what they published,
   * which makes rolling back a guess: you pick a version by its timestamp and
   * hope. This walks the two documents and reports the fields that differ, in
   * the panel's own vocabulary rather than as a JSON diff.
   *
   * `to` defaults to the current draft, so the common question — "what am I
   * about to publish?" — is the default answer.
   */
  async diff(from: number, to: number | null, tenantSlug?: string): Promise<ContentDiff> {
    const [before, after] = await Promise.all([
      this.getSnapshot(from, tenantSlug),
      to === null ? this.content.getSiteContent(tenantSlug) : this.getSnapshot(to, tenantSlug),
    ]);

    const changes: ContentChange[] = [];
    walk(before as unknown as Json, after as unknown as Json, [], changes);

    return {
      from,
      to,
      changes: changes.slice(0, MAX_DIFF_ENTRIES),
      // Reported rather than silently dropped: a list that stops at fifty and
      // says nothing reads as "these are all the changes".
      truncated: changes.length > MAX_DIFF_ENTRIES,
      total: changes.length,
    };
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
