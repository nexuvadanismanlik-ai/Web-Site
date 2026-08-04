import { z } from 'zod';
import {
  WEBSITE_COLLECTIONS,
  WEBSITE_COLLECTION_KEYS,
  WEBSITE_SECTION_KEYS,
  isWebsiteCollectionSlug,
  isWebsiteSectionKey,
  type WebsiteCollectionKey,
  type WebsiteCollectionSlug,
  type WebsiteSectionKey,
} from '@nexuva/shared';

/**
 * What the API knows about the website's collections that the shared registry
 * does not: how to validate a write.
 *
 * The names — document key, REST slug, Prisma model — come from
 * @nexuva/shared, so the panel and the API cannot disagree about them. Only
 * the schemas live here, because only the server validates.
 */

const localized = z.object({
  tr: z.string().max(4000),
  en: z.string().max(4000),
});

const ordering = {
  position: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
};

const navItem = z.object({
  label: localized,
  href: z.string().min(1).max(200),
  ...ordering,
});

const logo = z.object({
  name: z.string().min(1).max(120),
  imageUrl: z.string().url().max(500).nullish(),
  ...ordering,
});

const service = z.object({
  icon: z.string().min(1).max(60),
  title: localized,
  description: localized,
  features: z.array(localized).max(20),
  ...ordering,
});

const stat = z.object({
  value: z.number().int().min(0),
  prefix: z.string().max(10).nullish(),
  suffix: z.string().max(10).optional(),
  label: localized,
  ...ordering,
});

const reference = z.object({
  name: z.string().min(1).max(120),
  category: localized,
  logoUrl: z.string().url().max(500).nullish(),
  ...ordering,
});

const testimonial = z.object({
  quote: localized,
  author: z.string().min(1).max(120),
  role: localized,
  company: z.string().min(1).max(120),
  avatarUrl: z.string().url().max(500).nullish(),
  rating: z.number().int().min(1).max(5).optional(),
  ...ordering,
});

const processStep = z.object({
  title: localized,
  description: localized,
  ...ordering,
});

/** Per-collection knowledge that only the server holds. */
interface CollectionRules {
  /** Whether the model carries a deletedAt column. */
  softDelete: boolean;
  /** An object schema specifically, so updates can take `.partial()` of it. */
  create: z.AnyZodObject;
}

/**
 * Keyed by the document key, so adding a collection is one entry here and one
 * in the shared registry — and TypeScript requires both.
 */
const RULES = {
  nav: { softDelete: false, create: navItem },
  logos: { softDelete: false, create: logo },
  services: { softDelete: true, create: service },
  stats: { softDelete: false, create: stat },
  references: { softDelete: true, create: reference },
  testimonials: { softDelete: true, create: testimonial },
  process: { softDelete: false, create: processStep },
} as const satisfies Record<WebsiteCollectionKey, CollectionRules>;

export interface CollectionDef extends CollectionRules {
  /** Prisma model accessor on PrismaService. */
  model: (typeof WEBSITE_COLLECTIONS)[WebsiteCollectionKey]['model'];
}

/** Slug → everything the service needs to serve that collection. */
export const COLLECTION_DEFS = WEBSITE_COLLECTION_KEYS.reduce(
  (defs, key) => {
    defs[WEBSITE_COLLECTIONS[key].slug] = {
      ...RULES[key],
      model: WEBSITE_COLLECTIONS[key].model,
    };
    return defs;
  },
  {} as Record<WebsiteCollectionSlug, CollectionDef>,
);

export type CollectionSlug = WebsiteCollectionSlug;

export const COLLECTION_SLUGS = Object.keys(COLLECTION_DEFS) as CollectionSlug[];

export const isCollectionSlug = isWebsiteCollectionSlug;

/**
 * Singleton content blocks. Unlike collections these are single JSON documents
 * keyed by name, so they are stored in website_sections.
 */
export const SECTION_KEYS = WEBSITE_SECTION_KEYS;

export type SectionKey = WebsiteSectionKey;

export const isSectionKey = isWebsiteSectionKey;
