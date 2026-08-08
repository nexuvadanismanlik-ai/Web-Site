import type { MetadataRoute } from 'next';
import { getSiteContent } from '../lib/content';
import { siteOrigin } from '../lib/origin';

export const dynamic = 'force-static';

/**
 * The site's pages, for search engines.
 *
 * Listed rather than discovered because the site is five fixed routes; when
 * pages become content this reads them from the same place the router does.
 * Priorities say what matters: the home page, then the two pages that sell,
 * then the rest.
 */
const ROUTES: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/services/', priority: 0.9 },
  // The product page, and it ranks alongside services rather than below them:
  // it is the one page targeting a search anybody types with intent —
  // "freight forwarder yazılımı" — and it was missing from this list
  // entirely, which is the cheapest possible way to be invisible.
  { path: '/logiops/', priority: 0.9 },
  { path: '/references/', priority: 0.8 },
  { path: '/about/', priority: 0.7 },
  { path: '/contact/', priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getSiteContent();
  const origin = siteOrigin(content);
  // Without an origin an entry would be a relative URL, which is not a sitemap
  // any crawler accepts — better to emit nothing than something invalid.
  if (!origin) return [];

  // Static export bakes this at build time, and a publish rebuilds, so the
  // build date is genuinely when the content last changed.
  const lastModified = new Date();

  return ROUTES.map((route) => ({
    url: `${origin}${route.path}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: route.priority,
  }));
}
