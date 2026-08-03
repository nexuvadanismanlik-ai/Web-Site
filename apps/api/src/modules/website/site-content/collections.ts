import { z } from 'zod';

/**
 * Registry of the website's ordered content collections.
 *
 * Each entry binds a public REST slug to its Prisma model and the zod schema
 * that validates writes. Adding a new CMS collection means adding one entry
 * here — the service and controller are generic over this registry.
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

export interface CollectionDef {
  /** Prisma model accessor on PrismaService. */
  model:
    | 'websiteNavItem'
    | 'websiteLogo'
    | 'websiteService'
    | 'websiteStat'
    | 'websiteReference'
    | 'websiteTestimonial'
    | 'websiteProcessStep';
  /** Whether the model carries a deletedAt column. */
  softDelete: boolean;
  create: z.ZodTypeAny;
}

export const COLLECTION_DEFS = {
  'nav-items': { model: 'websiteNavItem', softDelete: false, create: navItem },
  logos: { model: 'websiteLogo', softDelete: false, create: logo },
  services: { model: 'websiteService', softDelete: true, create: service },
  stats: { model: 'websiteStat', softDelete: false, create: stat },
  references: { model: 'websiteReference', softDelete: true, create: reference },
  testimonials: { model: 'websiteTestimonial', softDelete: true, create: testimonial },
  'process-steps': { model: 'websiteProcessStep', softDelete: false, create: processStep },
} as const satisfies Record<string, CollectionDef>;

export type CollectionSlug = keyof typeof COLLECTION_DEFS;

export const COLLECTION_SLUGS = Object.keys(COLLECTION_DEFS) as CollectionSlug[];

export function isCollectionSlug(value: string): value is CollectionSlug {
  return Object.prototype.hasOwnProperty.call(COLLECTION_DEFS, value);
}

/**
 * Singleton content blocks. Unlike collections these are single JSON documents
 * keyed by name, so they are stored in website_sections.
 */
export const SECTION_KEYS = [
  'brand',
  'hero',
  'about',
  'cta',
  'contact',
  'footer',
  'servicesMeta',
  'referencesMeta',
  'testimonialsMeta',
  'processMeta',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}
