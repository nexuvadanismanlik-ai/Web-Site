import type { SiteContent } from '@nexuva/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

/**
 * Site content comes from the Nexuva API, which owns the database.
 *
 * The site is a static export, so this runs at BUILD time and the result is
 * baked into the generated HTML — publishing edited content means rebuilding
 * (a push, or a Render deploy hook). Nothing calls the API at runtime.
 *
 * Fetched once per build and memoised, so the ten prerendered pages share a
 * single request.
 */
let cached: Promise<SiteContent> | null = null;

async function fetchSiteContent(): Promise<SiteContent> {
  const url = `${API_BASE}/website/content`;

  let res: Response;
  try {
    // force-cache, not no-store: `no-store` marks the fetch as dynamic server
    // usage, which a static export cannot prerender. The content is meant to be
    // frozen into the build anyway.
    res = await fetch(url, { cache: 'force-cache' });
  } catch (err) {
    throw new Error(
      `Site content could not be fetched from ${url}. Is the API running and ` +
        `NEXT_PUBLIC_API_URL correct? (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  if (!res.ok) {
    throw new Error(`Site content request to ${url} failed with HTTP ${res.status}.`);
  }

  return (await res.json()) as SiteContent;
}

export async function getSiteContent(): Promise<SiteContent> {
  cached ??= fetchSiteContent();
  return cached;
}
