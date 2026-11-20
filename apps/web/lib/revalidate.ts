import { createHash, timingSafeEqual } from 'node:crypto';
import { SITE_CONTENT_TAG } from './cache-tags';

/**
 * Whether a revalidation request may run, and what it may refresh.
 *
 * Pure apart from the in-memory rate limiter, so every rule is testable:
 *   - the shared secret must match, compared in constant time;
 *   - the body must be small JSON (the route enforces the byte limit and
 *     passes null when it was exceeded);
 *   - only known tags and site paths can be requested;
 *   - a client gets a handful of calls per minute.
 *
 * The rate limit is per function instance, which on Vercel means it is a
 * brake rather than a wall — the secret is the actual control. A firewall rule
 * on /api/revalidate (VERCEL_DEPLOYMENT.md) is the shared limit.
 */
export const ALLOWED_TAGS: readonly string[] = [SITE_CONTENT_TAG];

/** Site paths that may be refreshed one by one. */
const ALLOWED_PATH = /^\/(?:[a-z0-9-]+\/?){0,3}$/;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export interface RevalidateInput {
  secret: string | null;
  expectedSecret: string | undefined;
  contentType: string | null;
  /** Raw body, or null when it exceeded the size limit. */
  body: string | null;
  clientKey: string;
  now: number;
}

export type RevalidateDecision =
  | { ok: true; tags: string[]; paths: string[] }
  | { ok: false; status: 400 | 401 | 413 | 415 | 429 | 503 };

export function checkRevalidateRequest(input: RevalidateInput): RevalidateDecision {
  // Not configured: refuse everything rather than accept everything.
  if (!input.expectedSecret || input.expectedSecret.length < 32) {
    return { ok: false, status: 503 };
  }

  if (!rateAllowed(input.clientKey, input.now)) return { ok: false, status: 429 };

  if (!input.secret || !secretsMatch(input.secret, input.expectedSecret)) {
    return { ok: false, status: 401 };
  }

  if (input.body === null) return { ok: false, status: 413 };

  if (input.body.trim() === '') {
    return { ok: true, tags: [SITE_CONTENT_TAG], paths: [] };
  }

  if (!input.contentType?.toLowerCase().startsWith('application/json')) {
    return { ok: false, status: 415 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    return { ok: false, status: 400 };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, status: 400 };
  }

  const { tags, paths } = parsed as { tags?: unknown; paths?: unknown };
  const wantedTags = tags === undefined ? [SITE_CONTENT_TAG] : tags;
  const wantedPaths = paths === undefined ? [] : paths;

  if (!isStringList(wantedTags) || !isStringList(wantedPaths)) return { ok: false, status: 400 };
  if (wantedTags.length + wantedPaths.length === 0) return { ok: false, status: 400 };
  if (wantedTags.length > 5 || wantedPaths.length > 20) return { ok: false, status: 400 };
  if (!wantedTags.every((tag) => ALLOWED_TAGS.includes(tag))) return { ok: false, status: 400 };
  if (!wantedPaths.every((path) => ALLOWED_PATH.test(path))) return { ok: false, status: 400 };

  return { ok: true, tags: [...new Set(wantedTags)], paths: [...new Set(wantedPaths)] };
}

/** Hashing first makes both sides the same length, as timingSafeEqual needs. */
function secretsMatch(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function rateAllowed(key: string, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound across many clients.
  if (hits.size > 1_000) {
    for (const [k, times] of hits) {
      if (times.every((at) => now - at >= RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return true;
}

/** Test hook: forget all recorded calls. */
export function resetRevalidateRateLimit(): void {
  hits.clear();
}
