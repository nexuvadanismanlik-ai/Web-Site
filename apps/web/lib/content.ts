import { cache } from 'react';
import type { SiteContent } from '@nexuva/types';
import { SITE_CONTENT_TAG } from './cache-tags';

export { SITE_CONTENT_TAG };

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

/**
 * Seconds before a cached copy is considered stale even without a publish.
 *
 * The safety net: if a revalidation call is ever lost, the site still picks
 * up the published content within this window. Do not set it to false.
 */
export const REVALIDATE_SECONDS = 300;

/**
 * Site content comes from the Nexuva API, which owns the database.
 *
 * The site runs on Vercel with ISR. This is a cached server fetch: the first
 * request renders the page and stores it; later requests are served from the
 * cache. Publishing in the panel makes the API call /api/revalidate, which
 * invalidates SITE_CONTENT_TAG, and the next request renders with the new
 * content — no rebuild, no deploy.
 *
 * If the API is unreachable when a page is regenerated, the fetch throws and
 * Next keeps serving the last good page rather than an error. A build with no
 * reachable API still fails, which is deliberate: there is no safe default
 * content for a company's website.
 *
 * Kept in one place on purpose: every page reads content through this
 * function, so the caching policy is a single decision.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const fixture = process.env['NEXUVA_CONTENT_FIXTURE'];
  if (fixture) return readFixture(fixture);
  return fetchSiteContent();
});

/**
 * Two attempts, close together.
 *
 * The longer back-off this replaced (up to 50 seconds) existed for a Render
 * service that suspended when idle. A Vercel Function wakes in about a second;
 * one quick retry covers that, and anything slower is a real outage the page
 * should not wait out.
 */
const ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;

async function fetchSiteContent(): Promise<SiteContent> {
  const url = `${API_BASE}/website/content`;

  let res: Response | undefined;
  let lastError = '';

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) {
      console.warn(`Site content fetch failed (${lastError}); retrying...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    try {
      res = await fetch(url, {
        next: { revalidate: REVALIDATE_SECONDS, tags: [SITE_CONTENT_TAG] },
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      res = undefined;
      continue;
    }

    // A 5xx is the API briefly unwell; a 4xx is a real answer retrying cannot change.
    if (res.ok || res.status < 500) break;
    lastError = `HTTP ${res.status}`;
  }

  if (!res) {
    throw new Error(
      `Site content could not be fetched from ${url} after ${ATTEMPTS} attempts. ` +
        `Is the API running and NEXT_PUBLIC_API_URL correct? (${lastError})`,
    );
  }

  if (!res.ok) {
    throw new Error(`Site content request to ${url} failed with HTTP ${res.status}.`);
  }

  return normalise(unwrapEnvelope(await res.json(), url));
}

/** The API answers in the standard envelope: {success, message, data}. */
function unwrapEnvelope(body: unknown, source: string): SiteContent {
  const content =
    body !== null && typeof body === 'object' && 'success' in body && 'data' in body
      ? (body as { data: unknown }).data
      : body;
  if (!content || typeof content !== 'object') {
    throw new Error(`Site content from ${source} has an unexpected shape.`);
  }
  return content as SiteContent;
}

/**
 * Content from a JSON file instead of the API.
 *
 * For CI and local builds that must not touch any database: set
 * NEXUVA_CONTENT_FIXTURE to a file such as test/fixtures/site-content.json.
 * Refused on a Vercel production deployment, so a stray variable can never put
 * fixture text on the live site.
 */
async function readFixture(file: string): Promise<SiteContent> {
  if (process.env['VERCEL_ENV'] === 'production') {
    throw new Error('NEXUVA_CONTENT_FIXTURE is not allowed on a production deployment.');
  }
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const raw = await readFile(path.resolve(process.cwd(), file), 'utf8');
  return normalise(unwrapEnvelope(JSON.parse(raw), file));
}

/**
 * Accepts content written by an older version of the API.
 *
 * The published snapshot is frozen at publish time, so a deploy that adds a
 * field is serving documents written before that field existed — for as long as
 * nobody publishes again. Logos used to be an array of names and are now
 * objects carrying an optional mark; reading the new shape out of the old one
 * would have rendered a strip of blanks on the live site.
 *
 * Cheap to keep, and the alternative is a site whose correctness depends on
 * somebody having pressed Publish after a deploy.
 */
function normalise(content: SiteContent): SiteContent {
  const logos = Array.isArray(content.logos)
    ? content.logos.map((entry) =>
        typeof entry === 'string' ? { name: entry } : (entry ?? { name: '' }),
      )
    : [];

  return { ...content, logos };
}
