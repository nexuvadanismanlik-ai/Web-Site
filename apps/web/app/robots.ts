import type { MetadataRoute } from 'next';
import { getSiteContent } from '../lib/content';
import { absoluteUrl, isIndexableDeployment } from '../lib/origin';


/** Same window as page content (lib/content.ts); a publish revalidates sooner. */
export const revalidate = 300;

/**
 * robots.txt — who may crawl what.
 *
 * Search engines and AI systems are allowed everywhere public. Three kinds of
 * AI agents are named, because they are separate decisions:
 *   - search/retrieval indexers (OAI-SearchBot, Claude-SearchBot,
 *     PerplexityBot, DuckAssistBot) decide whether Nexuva can appear in AI
 *     answers at all — blocking these is what makes a site invisible there;
 *   - user-triggered fetchers (ChatGPT-User, Claude-User, Perplexity-User)
 *     read a page because somebody asked about it;
 *   - training crawlers and opt-out tokens (GPTBot, ClaudeBot, Google-Extended,
 *     Applebot-Extended, CCBot, Meta-ExternalAgent). Allowed today; this is the
 *     line to change if Nexuva later decides its content should not be used
 *     for model training. Search visibility does not depend on them.
 *
 * A named group replaces the `*` group for that agent rather than adding to
 * it, so every group repeats the same disallow list. /api/ holds the
 * revalidation endpoint and nothing a crawler should request.
 *
 * Preview deployments and the panel's "hide from search engines" switch both
 * close the site entirely.
 */
const PRIVATE_PATHS = ['/api/'];

const AGENTS = [
  // Search engines
  'Googlebot',
  'Bingbot',
  // AI search / retrieval
  'OAI-SearchBot',
  'Claude-SearchBot',
  'PerplexityBot',
  'DuckAssistBot',
  // User-triggered fetchers
  'ChatGPT-User',
  'Claude-User',
  'Perplexity-User',
  // Training crawlers and opt-out tokens
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Meta-ExternalAgent',
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const content = await getSiteContent();
  const hidden = content.seo?.noIndex === true || !isIndexableDeployment();

  if (hidden) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  const sitemap = absoluteUrl('/sitemap.xml');

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
      ...AGENTS.map((userAgent) => ({ userAgent, allow: '/', disallow: PRIVATE_PATHS })),
    ],
    ...(sitemap ? { sitemap } : {}),
  };
}
