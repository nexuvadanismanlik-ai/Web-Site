import type { SiteContent } from '@nexuva/types';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

/**
 * Cache tag the API's revalidation call targets once this site runs as a
 * server deployment. Under `output: 'export'` Next ignores tags, so keeping it
 * here costs nothing and removes a step from the migration.
 */
export const SITE_CONTENT_TAG = 'site-content';

/**
 * Seconds before a cached copy is considered stale, once this site runs with
 * ISR. Not applied under `output: 'export'` — Next warns if a fetch specifies
 * both `cache` and `revalidate`, so it is wired up as part of the migration
 * rather than kept inert here. See apps/web/MIGRATION.md.
 */
export const REVALIDATE_SECONDS = 300;

/**
 * Site content comes from the Nexuva API, which owns the database.
 *
 * ── Today (static export on a Render Static Site) ──────────────────────────
 * There is no runtime, so this runs during `next build` and the result is baked
 * into the generated HTML. Publishing edited content therefore means rebuilding,
 * which the API triggers through its Render deploy hook.
 *
 * ── Target (Render Web Service, ISR) ───────────────────────────────────────
 * The same call becomes a cached server fetch. Editing content then invalidates
 * `SITE_CONTENT_TAG` through the site's /api/revalidate route and the next
 * request re-renders — no deploy. See apps/web/MIGRATION.md; the only change
 * needed in this file is the `cache` field below.
 *
 * Kept in one place on purpose: every page reads content through this function,
 * so the caching policy is a single decision rather than a scattered one.
 */
let cached: Promise<SiteContent> | null = null;

/**
 * Makes the request URL unique per build.
 *
 * Publishing content triggers a rebuild of the same commit, and `force-cache`
 * writes the API response into `.next/cache`, which the host restores between
 * builds. Without this the second and every later build reuses the response
 * captured by the first, so the site is built successfully and still shows the
 * content from whenever the cache was first populated — which is exactly what
 * happened in production. A per-build value gives the fetch a cache key that
 * cannot survive into the next build.
 *
 * The commit hash would not work: a content-only publish rebuilds the same
 * commit.
 */
const BUILD_NONCE = Date.now().toString(36);

async function fetchSiteContent(): Promise<SiteContent> {
  const url = `${API_BASE}/website/content?_build=${BUILD_NONCE}`;

  let res: Response;
  try {
    res = await fetch(url, {
      // MIGRATION SEAM — 'force-cache' is required by static export: 'no-store'
      // would mark the fetch dynamic and a static export cannot prerender that.
      // Moving to ISR means replacing this single line with:
      //   next: { revalidate: REVALIDATE_SECONDS, tags: [SITE_CONTENT_TAG] }
      cache: 'force-cache',
      next: { tags: [SITE_CONTENT_TAG] },
    });
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
