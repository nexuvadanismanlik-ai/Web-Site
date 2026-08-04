/**
 * The website CMS vocabulary: what content the site is made of.
 *
 * This was written out by hand in nine places — the API's collection registry,
 * the admin's content client, the version restorer, the seed, the visual
 * editor's two lookup tables, the site content type, the seed fixture and a
 * comment in the Prisma schema. Adding one section meant finding all of them,
 * and missing one failed silently: the section simply never appeared.
 *
 * It lives in the shared package because both the API and the panel need the
 * same answer, and neither owns it more than the other.
 */

/**
 * Singleton content blocks. Each is one JSON document in website_sections,
 * keyed by name.
 */
export const WEBSITE_SECTION_KEYS = [
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

export type WebsiteSectionKey = (typeof WEBSITE_SECTION_KEYS)[number];

export function isWebsiteSectionKey(value: string): value is WebsiteSectionKey {
  return (WEBSITE_SECTION_KEYS as readonly string[]).includes(value);
}

/**
 * Ordered collections, keyed by the name they carry in the site content
 * document.
 *
 * Three names exist for each collection because three layers name things
 * differently: the document calls it `process`, the REST path calls it
 * `process-steps`, and Prisma calls it `websiteProcessStep`. Keeping the three
 * side by side is what stops them drifting — they were previously spread across
 * five separate enumerations, in three mutually incompatible key spaces.
 */
export const WEBSITE_COLLECTIONS = {
  nav: { slug: 'nav-items', model: 'websiteNavItem' },
  logos: { slug: 'logos', model: 'websiteLogo' },
  services: { slug: 'services', model: 'websiteService' },
  stats: { slug: 'stats', model: 'websiteStat' },
  references: { slug: 'references', model: 'websiteReference' },
  testimonials: { slug: 'testimonials', model: 'websiteTestimonial' },
  process: { slug: 'process-steps', model: 'websiteProcessStep' },
} as const;

/** Key under which a collection appears in the site content document. */
export type WebsiteCollectionKey = keyof typeof WEBSITE_COLLECTIONS;

/** Segment a collection is addressed by over REST. */
export type WebsiteCollectionSlug =
  (typeof WEBSITE_COLLECTIONS)[WebsiteCollectionKey]['slug'];

export const WEBSITE_COLLECTION_KEYS = Object.keys(
  WEBSITE_COLLECTIONS,
) as WebsiteCollectionKey[];

export const WEBSITE_COLLECTION_SLUGS = WEBSITE_COLLECTION_KEYS.map(
  (key) => WEBSITE_COLLECTIONS[key].slug,
) as WebsiteCollectionSlug[];

/** Document key → REST slug, for a client holding the document. */
export const WEBSITE_SLUG_BY_KEY = Object.fromEntries(
  WEBSITE_COLLECTION_KEYS.map((key) => [key, WEBSITE_COLLECTIONS[key].slug]),
) as Record<WebsiteCollectionKey, WebsiteCollectionSlug>;

/** REST slug → document key, for a server holding a request path. */
export const WEBSITE_KEY_BY_SLUG = Object.fromEntries(
  WEBSITE_COLLECTION_KEYS.map((key) => [WEBSITE_COLLECTIONS[key].slug, key]),
) as Record<WebsiteCollectionSlug, WebsiteCollectionKey>;

export function isWebsiteCollectionSlug(value: string): value is WebsiteCollectionSlug {
  return Object.prototype.hasOwnProperty.call(WEBSITE_KEY_BY_SLUG, value);
}
