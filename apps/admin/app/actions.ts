'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import type { SiteContent } from '@nexuva/types';
import { authOptions } from '../lib/auth';
import {
  readSiteContent,
  writeSiteContent,
  readMessages,
  writeMessages,
} from '../lib/content';

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Unauthorized');
}

/** Persist a single top-level section of the site content. */
export async function saveSection<K extends keyof SiteContent>(
  key: K,
  value: SiteContent[K],
): Promise<{ ok: boolean }> {
  await requireAuth();
  const content = await readSiteContent();
  content[key] = value;
  await writeSiteContent(content);
  revalidatePath('/', 'layout');
  return { ok: true };
}

const EDITABLE_ROOTS = new Set([
  'brand',
  'nav',
  'hero',
  'logos',
  'servicesMeta',
  'services',
  'stats',
  'about',
  'referencesMeta',
  'references',
  'testimonialsMeta',
  'testimonials',
  'processMeta',
  'process',
  'cta',
  'contact',
  'footer',
]);

function isLocalized(v: unknown): v is { tr: string; en: string } {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as Record<string, unknown>)['tr'] === 'string' &&
    typeof (v as Record<string, unknown>)['en'] === 'string'
  );
}

/**
 * Persist a single leaf value addressed by a dot path (e.g. "hero.subtitle",
 * "services.2.title"). Used by the visual click-to-edit editor. The new value
 * must match the existing value's shape (Localized, string or number).
 */
export async function saveAtPath(
  path: string,
  value: unknown,
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  const segments = path.split('.').filter(Boolean);
  const root = segments[0];
  if (segments.length === 0 || !root || !EDITABLE_ROOTS.has(root)) {
    return { ok: false, error: 'invalid-path' };
  }

  const content = await readSiteContent();
  let parent: unknown = content;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i] as string;
    parent = (parent as Record<string, unknown>)?.[seg];
    if (parent == null || typeof parent !== 'object') {
      return { ok: false, error: 'invalid-path' };
    }
  }

  const key = segments[segments.length - 1] as string;
  const holder = parent as Record<string, unknown>;
  const current = holder[key];
  if (current === undefined) return { ok: false, error: 'missing' };

  if (isLocalized(current)) {
    if (!isLocalized(value)) return { ok: false, error: 'type-mismatch' };
    holder[key] = { tr: value.tr, en: value.en };
  } else if (typeof current === 'string') {
    if (typeof value !== 'string') return { ok: false, error: 'type-mismatch' };
    holder[key] = value;
  } else if (typeof current === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, error: 'type-mismatch' };
    holder[key] = n;
  } else {
    return { ok: false, error: 'unsupported-type' };
  }

  await writeSiteContent(content);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setMessageRead(id: string, read: boolean): Promise<{ ok: boolean }> {
  await requireAuth();
  const list = await readMessages();
  const next = list.map((m) => (m.id === id ? { ...m, read } : m));
  await writeMessages(next);
  revalidatePath('/messages');
  return { ok: true };
}

export async function deleteMessage(id: string): Promise<{ ok: boolean }> {
  await requireAuth();
  const list = await readMessages();
  await writeMessages(list.filter((m) => m.id !== id));
  revalidatePath('/messages');
  return { ok: true };
}

export async function markAllMessagesRead(): Promise<{ ok: boolean }> {
  await requireAuth();
  const list = await readMessages();
  await writeMessages(list.map((m) => ({ ...m, read: true })));
  revalidatePath('/messages');
  return { ok: true };
}
