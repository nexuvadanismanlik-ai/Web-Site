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

  return {
    rules: hidden
      ? { userAgent: '*', disallow: '/' }
      : { userAgent: '*', allow: '/' },
    ...(origin && !hidden ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
