import type { MetadataRoute } from 'next';
import { getSiteContent } from '../lib/content';
import { siteOrigin } from '../lib/origin';


// Static export: this is generated at build time like every other page.
export const dynamic = 'force-static';

/**
 * robots.txt, driven by the panel.
 *
 * The site had none, which means crawlers guessed — and the "hide from search
 * engines" switch had nowhere to take effect. Turning it on now closes the site
 * off in both places that matter: the meta tag and this file.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const content = await getSiteContent();
  const hidden = content.seo?.noIndex === true;
  const origin = siteOrigin(content);

  if (hidden) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  /**
   * The crawlers that answer questions, named explicitly.
   *
   * They are already allowed by the wildcard, so this changes nothing
   * technically — and that is the point of writing it down. These agents are
   * frequently blocked by default in copied robots files and by hosting
   * platforms' presets, and a site that wants to be quoted when somebody asks
   * an assistant "who does freight forwarder software in Turkey" cannot afford
   * to discover it was blocked by an inherited default nobody read.
   *
   * Listing them also makes the intent reviewable: if this company later
   * decides it does not want its content used for training, the line to change
   * is here rather than buried in a wildcard.
   */
  const answerEngines = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-User',
    'anthropic-ai',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
  ];

  return {
    rules: [
      { userAgent: '*', allow: '/' },
      ...answerEngines.map((userAgent) => ({ userAgent, allow: '/' })),
    ],
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
