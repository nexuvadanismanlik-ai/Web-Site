import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';
import { WebsiteStateService } from '../website-state.service';
import {
  COLLECTION_DEFS,
  SECTION_KEYS,
  isCollectionSlug,
  isSectionKey,
  type CollectionSlug,
  type SectionKey,
} from './collections';
import type { SiteContent } from '@nexuva/types';

type AnyRecord = Record<string, unknown>;

/**
 * Structural view of a Prisma model delegate. The generated delegates have
 * model-specific argument types, so the registry lookup casts once, here,
 * rather than sprinkling casts through the CRUD methods.
 */
interface CollectionDelegate {
  findMany(args?: AnyRecord): Promise<AnyRecord[]>;
  findFirst(args?: AnyRecord): Promise<AnyRecord | null>;
  create(args: AnyRecord): Promise<AnyRecord>;
  update(args: AnyRecord): Promise<AnyRecord>;
  updateMany(args: AnyRecord): Promise<AnyRecord>;
  delete(args: AnyRecord): Promise<AnyRecord>;
  deleteMany(args: AnyRecord): Promise<AnyRecord>;
}

@Injectable()
export class SiteContentService {
  private readonly logger = new Logger(SiteContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: WebsiteTenantService,
    private readonly state: WebsiteStateService,
  ) {}

  // ─── Assembly ─────────────────────────────────────────────────────────────

  /**
   * The document the public site is served from: the snapshot of the version
   * currently marked published.
   *
   * Draft and published are deliberately different reads. An editor saving a
   * headline changes the draft; visitors keep seeing the last published
   * version until someone publishes.
   */
  async getPublishedContent(tenantSlug?: string): Promise<SiteContent> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const version = await this.prisma.contentVersion.findFirst({
      where: { tenantId, isPublished: true },
      orderBy: { number: 'desc' },
      select: { snapshot: true },
    });

    if (!version) {
      // Nothing published yet. Serving the draft keeps a site that predates
      // versioning working, and makes the first publish an ordinary step
      // instead of a migration.
      this.logger.log(`No published version for tenant ${tenantId}; serving the draft.`);
      return this.getSiteContent(tenantSlug);
    }

    return version.snapshot as unknown as SiteContent;
  }

  /**
   * Builds the complete SiteContent document from the working tables.
   *
   * This is the DRAFT: it reflects every saved edit, published or not.
   * Ordered collections come back sorted by `position`; inactive and
   * soft-deleted rows are excluded.
   */
  async getSiteContent(tenantSlug?: string): Promise<SiteContent> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);

    const activeOrdered = {
      where: { tenantId, isActive: true },
      orderBy: { position: 'asc' as const },
    };
    const activeOrderedLive = {
      where: { tenantId, isActive: true, deletedAt: null },
      orderBy: { position: 'asc' as const },
    };

    const [
      sectionRows,
      navItems,
      logos,
      services,
      stats,
      references,
      testimonials,
      processSteps,
    ] = await Promise.all([
      this.prisma.websiteSection.findMany({ where: { tenantId } }),
      this.prisma.websiteNavItem.findMany(activeOrdered),
      this.prisma.websiteLogo.findMany(activeOrdered),
      this.prisma.websiteService.findMany(activeOrderedLive),
      this.prisma.websiteStat.findMany(activeOrdered),
      this.prisma.websiteReference.findMany(activeOrderedLive),
      this.prisma.websiteTestimonial.findMany(activeOrderedLive),
      this.prisma.websiteProcessStep.findMany(activeOrdered),
    ]);

    const sections = new Map(sectionRows.map((row) => [row.key, row.data]));
    const missing = SECTION_KEYS.filter((key) => !sections.has(key));
    if (missing.length > 0) {
      // Loud, but not fatal. Throwing here took down the public site and the
      // admin panel together — the panel reads this document on nearly every
      // page, so the one screen an operator would use to add the missing
      // section was the screen that stopped loading. A section that is absent
      // renders as empty, and the sections that do exist keep working.
      this.logger.error(
        `Website sections missing for tenant ${tenantId}: ${missing.join(', ')}. ` +
          'These render empty until they are created.',
      );
    }

    const section = <T>(key: SectionKey): T => (sections.get(key) ?? {}) as T;

    return {
      brand: section('brand'),
      nav: navItems.map((item) => ({
        label: item.label,
        href: item.href,
      })),
      hero: section('hero'),
      logos: logos.map((item) => item.name),
      servicesMeta: section('servicesMeta'),
      services: services.map((item) => ({
        id: item.id,
        icon: item.icon,
        title: item.title,
        description: item.description,
        features: item.features,
      })),
      stats: stats.map((item) => ({
        id: item.id,
        value: item.value,
        prefix: item.prefix ?? undefined,
        suffix: item.suffix,
        label: item.label,
      })),
      about: section('about'),
      referencesMeta: section('referencesMeta'),
      references: references.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
      })),
      testimonialsMeta: section('testimonialsMeta'),
      testimonials: testimonials.map((item) => ({
        id: item.id,
        quote: item.quote,
        author: item.author,
        role: item.role,
        company: item.company,
        rating: item.rating,
      })),
      processMeta: section('processMeta'),
      process: processSteps.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
      })),
      cta: section('cta'),
      contact: section('contact'),
      footer: section('footer'),
      // Localized fields come back as Prisma JsonValue; the column contents are
      // guaranteed by the write-side zod schemas.
    } as unknown as SiteContent;
  }

  // ─── Sections ─────────────────────────────────────────────────────────────

  async listSections(tenantSlug?: string) {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    return this.prisma.websiteSection.findMany({
      where: { tenantId },
      orderBy: { key: 'asc' },
    });
  }

  async getSection(key: string, tenantSlug?: string) {
    this.assertSectionKey(key);
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const row = await this.prisma.websiteSection.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (!row) throw new NotFoundException(`Section "${key}" not found`);
    return row;
  }

  /** Replaces a section's JSON payload, creating it when absent. */
  async upsertSection(key: string, data: unknown, tenantSlug?: string) {
    this.assertSectionKey(key);
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('Section data must be a JSON object');
    }
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const payload = data as Prisma.InputJsonValue;

    const saved = await this.prisma.websiteSection.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, data: payload },
      update: { data: payload },
    });
    this.state.contentChanged(tenantId);
    return saved;
  }

  private assertSectionKey(key: string): asserts key is SectionKey {
    if (!isSectionKey(key)) {
      throw new BadRequestException(
        `Unknown section "${key}". Allowed: ${SECTION_KEYS.join(', ')}`,
      );
    }
  }

  // ─── Collections (generic CRUD) ───────────────────────────────────────────

  async listItems(slug: string, tenantSlug?: string) {
    const def = this.def(slug);
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    return this.delegate(slug).findMany({
      where: def.softDelete ? { tenantId, deletedAt: null } : { tenantId },
      orderBy: { position: 'asc' },
    });
  }

  async createItem(slug: string, body: unknown, tenantSlug?: string) {
    const def = this.def(slug);
    const data = this.validate(def.create, body);
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);

    // Append to the end unless the caller pinned a position.
    if (data['position'] === undefined) {
      const last = await this.delegate(slug).findFirst({
        where: { tenantId },
        orderBy: { position: 'desc' },
      });
      const lastPosition = typeof last?.['position'] === 'number' ? last['position'] : -1;
      data['position'] = lastPosition + 1;
    }

    const created = await this.delegate(slug).create({ data: { ...data, tenantId } });
    this.state.contentChanged(tenantId);
    return created;
  }

  /**
   * Saves a whole collection in one call. The admin editors work on entire
   * arrays, so a save maps to one request rather than a diff of create, update
   * and delete calls. Positions follow array order.
   *
   * Rows are reconciled by id rather than dropped and rebuilt. The previous
   * implementation deleted every row and recreated it, which meant every id in
   * the collection changed on every save — reordering two services rewrote the
   * identity of all six. Nothing can reference a row that is reissued on each
   * edit: not a version history, not a rollback, not a permalink, not an
   * uploaded image attached to a specific item.
   *
   * An item arriving without a known id is new. An existing row missing from
   * the payload has been removed, and follows the model's own convention —
   * soft-deleted where the column exists, matching removeItem, so a deletion
   * made here is as recoverable as one made through the item endpoint.
   */
  async replaceCollection(slug: string, body: unknown, tenantSlug?: string) {
    const def = this.def(slug);
    if (!Array.isArray(body)) {
      throw new BadRequestException('Body must be an array of collection items');
    }

    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const delegate = this.delegate(slug);

    // `id` is not part of the write schema — zod strips it — so it is read off
    // the raw item before validation.
    const incoming = body.map((item, index) => {
      const raw = (item ?? {}) as AnyRecord;
      const id = typeof raw['id'] === 'string' && raw['id'] ? raw['id'] : null;
      return { id, data: { ...this.validate(def.create, item), position: index } };
    });

    const live = await delegate.findMany({
      where: def.softDelete ? { tenantId, deletedAt: null } : { tenantId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    const liveIds = live.map((row) => String(row['id']));
    const available = new Set(liveIds);

    // Claim by explicit id first, so a reorder cannot make two items compete
    // for the same row.
    const target = new Map<number, string>();
    incoming.forEach((item, index) => {
      if (item.id !== null && available.has(item.id)) {
        target.set(index, item.id);
        available.delete(item.id);
      }
    });

    // Then pair anything id-less with the next unclaimed row, in position
    // order. Logos have no id in the site's content model — they are plain
    // strings — so without this they would be recreated on every save, which
    // is the problem this method exists to stop.
    const unclaimed = liveIds.filter((id) => available.has(id));
    let next = 0;
    incoming.forEach((item, index) => {
      if (target.has(index)) return;
      const candidate = unclaimed[next];
      if (candidate !== undefined) {
        target.set(index, candidate);
        available.delete(candidate);
        next++;
      }
    });

    const dropped = liveIds.filter((id) => available.has(id));

    // Built as a list of operations rather than an interactive transaction: the
    // previous version awaited one INSERT per row inside an open transaction,
    // holding it for the length of the round trips. Prisma sends this as a
    // single batch.
    const operations = incoming.map((item, index) => {
      const id = target.get(index);
      return id !== undefined
        ? delegate.update({ where: { id }, data: item.data })
        : delegate.create({ data: { ...item.data, tenantId } });
    });

    if (dropped.length > 0) {
      operations.push(
        def.softDelete
          ? delegate.updateMany({
              where: { id: { in: dropped } },
              data: { deletedAt: new Date(), isActive: false },
            })
          : delegate.deleteMany({ where: { id: { in: dropped } } }),
      );
    }

    await this.prisma.$transaction(operations as never);

    this.state.contentChanged(tenantId);
    return this.listItems(slug, tenantSlug);
  }

  async updateItem(slug: string, id: string, body: unknown, tenantSlug?: string) {
    const def = this.def(slug);
    const data = this.validate(def.create.partial(), body);
    const tenantId = await this.assertItemExists(slug, id, tenantSlug);
    const updated = await this.delegate(slug).update({ where: { id }, data });
    this.state.contentChanged(tenantId);
    return updated;
  }

  /** Soft-deletes when the model supports it; hard-deletes otherwise. */
  async removeItem(slug: string, id: string, tenantSlug?: string) {
    const def = this.def(slug);
    const tenantId = await this.assertItemExists(slug, id, tenantSlug);

    const removed = def.softDelete
      ? await this.delegate(slug).update({
          where: { id },
          data: { deletedAt: new Date(), isActive: false },
        })
      : await this.delegate(slug).delete({ where: { id } });

    this.state.contentChanged(tenantId);
    return removed;
  }

  /** Applies a new ordering; ids not listed keep their current position. */
  async reorderItems(slug: string, ids: string[], tenantSlug?: string) {
    this.def(slug);
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);

    const owned = await this.delegate(slug).findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException('Reorder list contains items from another tenant or unknown ids');
    }

    const delegate = this.delegate(slug);
    await this.prisma.$transaction(
      ids.map((id, index) =>
        delegate.update({ where: { id }, data: { position: index } }),
      ) as never,
    );
    this.state.contentChanged(tenantId);
    return this.listItems(slug, tenantSlug);
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private def(slug: string) {
    if (!isCollectionSlug(slug)) {
      throw new BadRequestException(
        `Unknown collection "${slug}". Allowed: ${Object.keys(COLLECTION_DEFS).join(', ')}`,
      );
    }
    return COLLECTION_DEFS[slug as CollectionSlug];
  }

  private delegate(slug: string): CollectionDelegate {
    const def = this.def(slug);
    return this.prisma[def.model] as unknown as CollectionDelegate;
  }

  private validate(schema: { safeParse(v: unknown): SafeParseLike }, body: unknown): AnyRecord {
    const result = schema.safeParse(body);
    if (!result.success) {
      const issues = (result.error?.issues ?? []).map(
        (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
      );
      throw new BadRequestException({ message: 'Validation failed', errors: issues });
    }
    return result.data as AnyRecord;
  }

  /** Returns the resolved tenant so callers do not have to look it up again. */
  private async assertItemExists(
    slug: string,
    id: string,
    tenantSlug?: string,
  ): Promise<string> {
    const def = this.def(slug);
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const found = await this.delegate(slug).findFirst({
      where: def.softDelete ? { id, tenantId, deletedAt: null } : { id, tenantId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`${slug} item "${id}" not found`);
    return tenantId;
  }
}

interface SafeParseLike {
  success: boolean;
  data?: unknown;
  error?: { issues: { path: (string | number)[]; message: string }[] };
}
