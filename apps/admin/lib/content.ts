import type { SiteContent, ContactMessage } from '@nexuva/types';
import { apiFetch } from './api';

/**
 * Content access for the admin panel. Everything goes through the Nexuva API,
 * which owns the database — the panel keeps no local copy and never touches
 * content/site.json (that file is now only a seed fixture).
 *
 * The exported read functions keep their original names and shapes so the
 * editor pages did not have to change.
 */

/** Singleton sections stored as one JSON document each. */
const SECTION_KEYS = new Set([
  'brand',
  'hero',
  'about',
  'cta',
  'contact',
  'footer',
  'servicesMeta',
  'referencesMeta',
  'testimonialsMeta',
  'processMeta',
]);

/** SiteContent key → API collection slug. */
const COLLECTION_SLUGS: Record<string, string> = {
  nav: 'nav-items',
  logos: 'logos',
  services: 'services',
  stats: 'stats',
  references: 'references',
  testimonials: 'testimonials',
  process: 'process-steps',
};

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function readSiteContent(): Promise<SiteContent> {
  // The assembled document is public, so this read needs no bearer token and
  // still works on the login page.
  return apiFetch<SiteContent>('/website/content', { auth: false });
}

interface ApiContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface ApiMessageList {
  items: ApiContactMessage[];
  meta: { page: number; limit: number; total: number; unread: number; totalPages: number };
}

/** The UI models a message with `read`; the API exposes `isRead`. */
function toContactMessage(m: ApiContactMessage): ContactMessage {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone ?? '',
    subject: m.subject ?? '',
    message: m.message,
    createdAt: m.createdAt,
    read: m.isRead,
  };
}

export async function readMessages(): Promise<ContactMessage[]> {
  const res = await apiFetch<ApiMessageList>('/website/contact?limit=100');
  return res.items.map(toContactMessage);
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/** Strips fields the API assigns itself before sending a collection item. */
function toApiItems(key: string, value: unknown): Record<string, unknown>[] {
  const list = Array.isArray(value) ? value : [];

  if (key === 'logos') {
    // Logos are plain strings in SiteContent but rows with a name in the API.
    return list.map((name) => ({ name: String(name) }));
  }

  return list.map((raw) => {
    const item = { ...(raw as Record<string, unknown>) };
    delete item['id'];
    delete item['position'];
    return item;
  });
}

/**
 * Persists one top-level key of SiteContent. Singleton sections are replaced as
 * a document; ordered lists are replaced as a whole collection, matching how
 * the editors save.
 */
export async function saveSectionViaApi(key: string, value: unknown): Promise<void> {
  if (SECTION_KEYS.has(key)) {
    await apiFetch(`/website/sections/${key}`, {
      method: 'PUT',
      body: JSON.stringify(value),
    });
    return;
  }

  const slug = COLLECTION_SLUGS[key];
  if (!slug) throw new Error(`Unknown content section "${key}"`);

  await apiFetch(`/website/collections/${slug}`, {
    method: 'PUT',
    body: JSON.stringify(toApiItems(key, value)),
  });
}

function setNested(target: Record<string, unknown>, segments: string[], value: unknown): boolean {
  let holder: Record<string, unknown> = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const next = holder[segments[i] as string];
    if (next == null || typeof next !== 'object') return false;
    holder = next as Record<string, unknown>;
  }
  const last = segments[segments.length - 1] as string;
  if (!(last in holder)) return false;
  holder[last] = value;
  return true;
}

/**
 * Persists a single leaf addressed by a dot path, e.g. "hero.subtitle" or
 * "services.2.title" — the paths emitted by the visual click-to-edit overlay.
 *
 * Collection paths carry an array index, which the API does not address
 * directly, so the index is resolved against the ordered list to find the row.
 */
export async function saveLeafViaApi(
  path: string,
  value: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const segments = path.split('.').filter(Boolean);
  const root = segments[0];
  if (!root) return { ok: false, error: 'invalid-path' };

  // ── Singleton section ────────────────────────────────────────────────────
  if (SECTION_KEYS.has(root)) {
    const section = await apiFetch<{ data: Record<string, unknown> }>(
      `/website/sections/${root}`,
    );
    const doc = section.data;
    if (segments.length < 2) return { ok: false, error: 'invalid-path' };
    if (!setNested(doc, segments.slice(1), value)) {
      return { ok: false, error: 'missing' };
    }
    await apiFetch(`/website/sections/${root}`, {
      method: 'PUT',
      body: JSON.stringify(doc),
    });
    return { ok: true };
  }

  // ── Ordered collection ───────────────────────────────────────────────────
  const slug = COLLECTION_SLUGS[root];
  if (!slug) return { ok: false, error: 'invalid-path' };

  const index = Number(segments[1]);
  if (!Number.isInteger(index) || index < 0) return { ok: false, error: 'invalid-path' };

  const items = await apiFetch<Record<string, unknown>[]>(`/website/collections/${slug}`);
  const item = items[index];
  if (!item) return { ok: false, error: 'missing' };
  const id = item['id'];
  if (typeof id !== 'string') return { ok: false, error: 'missing' };

  const rest = segments.slice(2);

  // logos.<i> addresses the row itself, whose editable text is `name`.
  if (rest.length === 0) {
    if (root !== 'logos' || typeof value !== 'string') {
      return { ok: false, error: 'unsupported-type' };
    }
    await apiFetch(`/website/collections/${slug}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: value }),
    });
    return { ok: true };
  }

  const field = rest[0] as string;
  if (!(field in item)) return { ok: false, error: 'missing' };

  let payloadValue: unknown;
  if (rest.length === 1) {
    payloadValue = value;
  } else {
    // Nested inside the field, e.g. services.<i>.features.<j>
    const current = item[field];
    if (current == null || typeof current !== 'object') {
      return { ok: false, error: 'missing' };
    }
    const clone = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
    if (!setNested(clone, rest.slice(1), value)) return { ok: false, error: 'missing' };
    payloadValue = clone;
  }

  await apiFetch(`/website/collections/${slug}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ [field]: payloadValue }),
  });
  return { ok: true };
}

// ─── Messages ───────────────────────────────────────────────────────────────

export async function setMessageReadViaApi(id: string, read: boolean): Promise<void> {
  await apiFetch(`/website/contact/${id}/read`, {
    method: 'PATCH',
    body: JSON.stringify({ isRead: read }),
  });
}

export async function deleteMessageViaApi(id: string): Promise<void> {
  await apiFetch(`/website/contact/${id}`, { method: 'DELETE' });
}

// ─── Publishing ─────────────────────────────────────────────────────────────

export interface PublishResult {
  ok: boolean;
  strategy: 'deploy-hook' | 'revalidate' | 'none';
  at: string;
  detail: string;
}

export interface PublishStatus {
  strategy: 'deploy-hook' | 'revalidate' | 'none';
  configured: boolean;
  autoPublish: boolean;
  pendingChanges: boolean;
  lastChangeAt: string | null;
  lastPublish: PublishResult | null;
}

export async function publishViaApi(): Promise<PublishResult> {
  return apiFetch<PublishResult>('/website/publish', { method: 'POST' });
}

export async function readPublishStatus(): Promise<PublishStatus> {
  return apiFetch<PublishStatus>('/website/publish/status');
}

// ─── Account ────────────────────────────────────────────────────────────────

export async function changePasswordViaApi(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
