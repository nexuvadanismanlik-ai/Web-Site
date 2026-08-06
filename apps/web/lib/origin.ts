import type { SiteContent } from '@nexuva/types';

/**
 * Where the published site lives.
 *
 * A canonical address, a sitemap and an OpenGraph image all have to be
 * absolute, so something has to know the origin. The build environment is the
 * obvious place — but the panel is the place somebody can actually change, and
 * "no file should have to be edited by hand" is the standard this project is
 * held to. So: the environment if it is set, otherwise the canonical address
 * typed into the SEO screen.
 *
 * Returns an empty string when neither is available, and every caller treats
 * that as "emit nothing" rather than emitting a relative URL that no crawler
 * and no social network can resolve.
 */
export function siteOrigin(content?: Pick<SiteContent, 'seo'>): string {
  const fromEnv = (process.env['NEXT_PUBLIC_SITE_URL'] ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const canonical = content?.seo?.canonical?.trim();
  if (!canonical) return '';
  try {
    return new URL(canonical).origin;
  } catch {
    return '';
  }
}
