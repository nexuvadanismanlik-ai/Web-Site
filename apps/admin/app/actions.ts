'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import type { SiteContent } from '@nexuva/types';
import { authOptions } from '../lib/auth';
import {
  readMessages,
  saveSectionViaApi,
  saveLeafViaApi,
  setMessageReadViaApi,
  deleteMessageViaApi,
} from '../lib/content';

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Unauthorized');
}

/** Persist a single top-level section of the site content. */
export async function saveSection<K extends keyof SiteContent>(
  key: K,
  value: SiteContent[K],
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    await saveSectionViaApi(key as string, value);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'save-failed' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Persist a single leaf value addressed by a dot path (e.g. "hero.subtitle",
 * "services.2.title"). Used by the visual click-to-edit editor.
 */
export async function saveAtPath(
  path: string,
  value: unknown,
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    const result = await saveLeafViaApi(path, value);
    if (!result.ok) return result;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'save-failed' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setMessageRead(id: string, read: boolean): Promise<{ ok: boolean }> {
  await requireAuth();
  await setMessageReadViaApi(id, read);
  revalidatePath('/messages');
  return { ok: true };
}

export async function deleteMessage(id: string): Promise<{ ok: boolean }> {
  await requireAuth();
  await deleteMessageViaApi(id);
  revalidatePath('/messages');
  return { ok: true };
}

export async function markAllMessagesRead(): Promise<{ ok: boolean }> {
  await requireAuth();
  const list = await readMessages();
  await Promise.all(
    list.filter((m) => !m.read).map((m) => setMessageReadViaApi(m.id, true)),
  );
  revalidatePath('/messages');
  return { ok: true };
}
