import type { MetadataRoute } from 'next';
import { getSiteContent } from '../lib/content';
import { absoluteUrl } from '../lib/origin';
import { servicePath } from '../lib/services';

/** Same window as page content (lib/content.ts); a publish revalidates sooner. */
export const revalidate = 300;

/**
 * Every indexable page, for search engines.
 *
 * Fixed pages plus one entry per service. The application form is left out on
 * purpose: it is noindex, and a sitemap that lists a noindex page sends Search
 * Console a contradiction to report.
 *
 * lastModified is the date the current content was published, not the build
 * date. Under ISR there is no "build" per publish, and a lastmod that changes
 * on every request teaches Google to ignore it.
 */
const FIXED: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/services', priority: 0.9 },
  { path: '/logiops', priority: 0.9 },
  { path: '/references', priority: 0.7 },
  { path: '/about', priority: 0.7 },
  { path: '/contact', priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getSiteContent();
  // Without an origin an entry would be a relative URL, which is not a sitemap
  // any crawler accepts — better to emit nothing than something invalid.
  if (!absoluteUrl('/')) return [];

  const published = content.publication?.publishedAt;
  const lastModified = published ? new Date(published) : undefined;

  const entries = [
    ...FIXED,
    ...content.services.map((service) => ({ path: servicePath(service), priority: 0.8 })),
  ];

  return entries.map((entry) => ({
    url: absoluteUrl(entry.path),
    ...(lastModified ? { lastModified } : {}),
    changeFrequency: 'monthly' as const,
    priority: entry.priority,
  }));
}
