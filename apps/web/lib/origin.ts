/**
 * Where the published site lives — one answer, from one place.
 *
 * A canonical address, a sitemap, OpenGraph tags and JSON-LD identifiers all
 * have to be absolute, so something has to know the origin. It used to fall
 * back to the canonical typed into the panel's SEO screen. That field still
 * held the old Render address after the site moved to Vercel, and because it
 * fed every page, the live site told search engines and language models that
 * its real home was a host it no longer ran on. A value that silently outlives
 * a migration does not belong in the content database.
 *
 * So the origin is deployment configuration, read in this order:
 *
 *   1. NEXT_PUBLIC_SITE_URL — set it per environment in the Vercel project.
 *      This is the only switch to flip when the permanent domain is connected.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — provided by Vercel on every deployment,
 *      preview included: the project's production host. A preview therefore
 *      points its canonical at production, which is what a preview should do.
 *
 * Returns an empty string when neither is available (a local build without the
 * variable), and every caller treats that as "emit nothing" rather than emit a
 * relative URL no crawler can resolve. The panel's canonical field is ignored
 * on purpose.
 */
export function siteOrigin(): string {
  const explicit = normalise(process.env['NEXT_PUBLIC_SITE_URL']);
  if (explicit) return explicit;

  const vercelProduction = (process.env['VERCEL_PROJECT_PRODUCTION_URL'] ?? '').trim();
  if (vercelProduction) return normalise(`https://${vercelProduction}`);

  return '';
}

/** An absolute URL for a site path, or '' when the origin is unknown. */
export function absoluteUrl(path: string): string {
  const origin = siteOrigin();
  if (!origin) return '';
  if (path === '' || path === '/') return `${origin}/`;
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  // The site is built with trailingSlash: true, so the address a crawler is
  // served — and the one it should be told is canonical — ends in a slash.
  // A canonical that differs from the served URL by one character is still a
  // different URL, and Google treats it as a redirect hint it may ignore.
  const cut = withLeading.search(/[?#]/);
  const pathname = cut === -1 ? withLeading : withLeading.slice(0, cut);
  const rest = cut === -1 ? '' : withLeading.slice(cut);
  const isFile = /\.[a-z0-9]+$/i.test(pathname);
  const slashed = pathname.endsWith('/') || isFile ? pathname : `${pathname}/`;
  return `${origin}${slashed}${rest}`;
}

/**
 * Whether search engines should be kept out of this deployment.
 *
 * Only production is indexable. Vercel sets VERCEL_ENV on every deployment; a
 * preview or development build announces noindex so a branch deployment can
 * never compete with the real site in results.
 */
export function isIndexableDeployment(): boolean {
  const env = process.env['VERCEL_ENV'];
  return env === undefined || env === 'production';
}

function normalise(value: string | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.origin;
  } catch {
    return '';
  }
}
