import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Where a file is used on the site.
 *
 * A media library without this answer is a trap. Somebody tidying up sees a
 * file they do not recognise, deletes it, and the logo disappears from the
 * header — with nothing anywhere to connect the two events. So before a file
 * can be deleted, the panel asks this and says what will break.
 */
export interface MediaUsage {
  /** Where it is used, in the panel's own words: "Hero", "Hizmetler". */
  label: string;
  /** Which admin screen to open to change it. */
  href: string;
  /** The specific row, when the place is a collection. */
  detail?: string;
}

/** Section key → what the panel calls that screen. */
const SECTION_LABELS: Record<string, { label: string; href: string }> = {
  brand: { label: 'Marka', href: '/content/brand' },
  hero: { label: 'Hero', href: '/content/hero' },
  about: { label: 'Hakkımızda', href: '/content/about' },
  cta: { label: 'CTA', href: '/content/cta' },
  contact: { label: 'İletişim', href: '/content/contact' },
  footer: { label: 'Alt Bilgi', href: '/content/footer' },
  servicesMeta: { label: 'Hizmetler başlığı', href: '/content/services' },
  referencesMeta: { label: 'Referanslar başlığı', href: '/content/references' },
  testimonialsMeta: { label: 'Yorumlar başlığı', href: '/content/testimonials' },
  processMeta: { label: 'Süreç başlığı', href: '/content/process' },
  seo: { label: 'SEO', href: '/seo' },
  uiText: { label: 'Arayüz Metinleri', href: '/content/ui-text' },
  integrations: { label: 'Entegrasyonlar', href: '/integrations' },
};

/**
 * Collections that can carry an image, and which of their columns can.
 *
 * Written out rather than derived from the Prisma DMMF: the DMMF would tell us
 * a column is a nullable string, not that it holds a URL, and a scan of every
 * string column of every table would match a description that happens to
 * mention the filename.
 */
const COLLECTION_IMAGE_FIELDS = [
  {
    model: 'websiteLogo' as const,
    columns: ['imageUrl'],
    label: 'Logolar',
    href: '/content/logos',
    name: 'name',
  },
  {
    model: 'websiteService' as const,
    columns: ['imageUrl'],
    label: 'Hizmetler',
    href: '/content/services',
    name: 'title',
  },
  {
    model: 'websiteReference' as const,
    columns: ['logoUrl', 'imageUrl'],
    label: 'Referanslar',
    href: '/content/references',
    name: 'name',
  },
  {
    model: 'websiteTestimonial' as const,
    columns: ['avatarUrl'],
    label: 'Yorumlar',
    href: '/content/testimonials',
    name: 'author',
  },
  {
    model: 'websiteProcessStep' as const,
    columns: ['imageUrl'],
    label: 'Süreç',
    href: '/content/process',
    name: 'title',
  },
];

@Injectable()
export class MediaUsageService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every place on the site that points at these URLs.
   *
   * Takes a list so the library can answer for a whole page of files in two
   * queries instead of two per file — a fifty-file page was a hundred queries
   * and a visibly slow screen.
   */
  async findUsage(tenantId: string, urls: string[]): Promise<Record<string, MediaUsage[]>> {
    const wanted = urls.filter((url) => url.length > 0);
    const usage: Record<string, MediaUsage[]> = {};
    for (const url of wanted) usage[url] = [];
    if (wanted.length === 0) return usage;

    const [sections, collections] = await Promise.all([
      this.scanSections(tenantId, wanted),
      this.scanCollections(tenantId, wanted),
    ]);

    for (const hit of [...sections, ...collections]) {
      usage[hit.url]?.push(hit.where);
    }

    return usage;
  }

  /**
   * Sections are JSON documents with no fixed shape — a URL can be at
   * `image`, at `logo.dark`, or inside an array of items — so they are matched
   * on the serialised document rather than on named columns. Coarse, but it
   * cannot miss a nesting nobody anticipated, and missing a use is the failure
   * that costs somebody their header logo.
   */
  private async scanSections(
    tenantId: string,
    urls: string[],
  ): Promise<{ url: string; where: MediaUsage }[]> {
    const rows = await this.prisma.$queryRaw<{ key: string; data: string }[]>`
      SELECT "key", "data"::text AS data
      FROM website_sections
      WHERE "tenantId" = ${tenantId}
    `;

    const hits: { url: string; where: MediaUsage }[] = [];
    for (const row of rows) {
      const meta = SECTION_LABELS[row.key];
      if (!meta) continue;
      for (const url of urls) {
        // JSON escapes forward slashes in some encoders and not others, so the
        // filename tail is compared rather than the whole URL.
        if (row.data.includes(url) || row.data.includes(tail(url))) {
          hits.push({ url, where: { label: meta.label, href: meta.href } });
        }
      }
    }
    return hits;
  }

  /** Collections have named image columns, so they are matched exactly. */
  private async scanCollections(
    tenantId: string,
    urls: string[],
  ): Promise<{ url: string; where: MediaUsage }[]> {
    const results = await Promise.all(
      COLLECTION_IMAGE_FIELDS.map(async (entry) => {
        const delegate = this.prisma[entry.model] as {
          findMany(args: unknown): Promise<Record<string, unknown>[]>;
        };

        const rows = await delegate.findMany({
          where: {
            tenantId,
            OR: entry.columns.map((column) => ({ [column]: { in: urls } })),
          },
          select: Object.fromEntries([
            [entry.name, true],
            ...entry.columns.map((column) => [column, true]),
          ]) as Prisma.WebsiteLogoSelect,
        });

        return rows.flatMap((row) =>
          entry.columns
            .map((column) => row[column])
            .filter((value): value is string => typeof value === 'string' && urls.includes(value))
            .map((url) => ({
              url,
              where: {
                label: entry.label,
                href: entry.href,
                detail: readName(row[entry.name]),
              },
            })),
        );
      }),
    );

    return results.flat();
  }
}

/** The filename, for matching a URL that was re-encoded on its way into JSON. */
function tail(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1] ?? url;
}

/**
 * A collection row's display name.
 *
 * Titles are `Localized` JSON in some collections and a plain string in
 * others, so both shapes are handled rather than assumed.
 */
function readName(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 80);
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const tr = localized['tr'];
    if (typeof tr === 'string') return tr.slice(0, 80);
  }
  return '';
}
