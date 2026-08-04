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
  delete(args: AnyRecord): Promise<AnyRecord>;
}

@Injectable()
export class SiteContentService {
  private readonly logger = new Logger(SiteContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: WebsiteTenantService,
  ) {}

  // ─── Assembly ─────────────────────────────────────────────────────────────

  /**
   * Builds the complete SiteContent document consumed by the public site at
   * build time. Ordered collections come back sorted by `position`; inactive
   * and soft-deleted rows are excluded.
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
      // Shipping a half-populated document would silently break the built site,
      // so surface the misconfiguration instead.
      this.logger.error(`Website sections missing for tenant ${tenantId}: ${missing.join(', ')}`);
      throw new InternalServerErrorException(
        `Website content is not fully configured. Missing sections: ${missing.join(', ')}`,
      );
    }

    const section = <T>(key: SectionKey): T => sections.get(key) as T;

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

    return this.prisma.websiteSection.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, data: payload },
      update: { data: payload },
    });
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

    return this.delegate(slug).create({ data: { ...data, tenantId } });
  }

  /**
   * Replaces an entire collection in one call. The admin editors work on whole
   * arrays, so this maps to a single save instead of a diff of create/update/
   * delete calls. Positions follow array order.
   *
   * Rows are removed outright rather than soft-deleted: this is a content
   * replacement, and leaving tombstones would grow the table on every save.
   */
  async replaceCollection(slug: string, body: unknown, tenantSlug?: string) {
    const def = this.def(slug);
    if (!Array.isArray(body)) {
      throw new BadRequestException('Body must be an array of collection items');
    }

    const rows = body.map((item, index) => {
      const data = this.validate(def.create, item);
      return { ...data, position: index };
    });

    const tenantId = await this.tenants.resolveTenantId(tenantSlug);

    await this.prisma.$transaction(async (tx) => {
      const txDelegate = (tx as unknown as Record<string, ReplaceDelegate>)[def.model];
      if (!txDelegate) throw new InternalServerErrorException(`Unknown model ${def.model}`);
      await txDelegate.deleteMany({ where: { tenantId } });
      for (const row of rows) {
        await txDelegate.create({ data: { ...row, tenantId } });
      }
    });

    return this.listItems(slug, tenantSlug);
  }

  async updateItem(slug: string, id: string, body: unknown, tenantSlug?: string) {
    const def = this.def(slug);
    const data = this.validate(def.create.partial(), body);
    await this.assertItemExists(slug, id, tenantSlug);
    return this.delegate(slug).update({ where: { id }, data });
  }

  /** Soft-deletes when the model supports it; hard-deletes otherwise. */
  async removeItem(slug: string, id: string, tenantSlug?: string) {
    const def = this.def(slug);
    await this.assertItemExists(slug, id, tenantSlug);

    if (def.softDelete) {
      return this.delegate(slug).update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
    }
    return this.delegate(slug).delete({ where: { id } });
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

  private async assertItemExists(slug: string, id: string, tenantSlug?: string) {
    const def = this.def(slug);
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const found = await this.delegate(slug).findFirst({
      where: def.softDelete ? { id, tenantId, deletedAt: null } : { id, tenantId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`${slug} item "${id}" not found`);
  }
}

interface SafeParseLike {
  success: boolean;
  data?: unknown;
  error?: { issues: { path: (string | number)[]; message: string }[] };
}

/** Delegate subset used inside the replace transaction. */
interface ReplaceDelegate {
  deleteMany(args: AnyRecord): Promise<unknown>;
  create(args: AnyRecord): Promise<unknown>;
}
