'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import type { SiteContent } from '@nexuva/types';
import { authOptions } from '../lib/auth';
import { adminPath } from '../lib/routes';
import {
  markAllMessagesReadViaApi,
  saveSectionViaApi,
  saveLeafViaApi,
  setMessageReadViaApi,
  deleteMessageViaApi,
  publishViaApi,
  readPublishStatus,
  changePasswordViaApi,
  readVersions,
  restoreVersionViaApi,
  readMedia,
  uploadMediaViaApi,
  deleteMediaViaApi,
  MEDIA_FOLDERS,
  type MediaList,
  type MediaFile,
  type MediaFolder,
  type PublishResult,
  type PublishStatus,
  type ContentVersion,
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
  // Scoped to the admin subtree: once the panel lives inside the public site,
  // an unqualified '/' would revalidate the marketing pages instead.
  revalidatePath(adminPath('/'), 'layout');
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
  // Scoped to the admin subtree: once the panel lives inside the public site,
  // an unqualified '/' would revalidate the marketing pages instead.
  revalidatePath(adminPath('/'), 'layout');
  return { ok: true };
}

// Every action reports failure the same way: by returning it. A server action
// that throws loses its message in production, so the caller would only see a
// generic render error.
export async function setMessageRead(
  id: string,
  read: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    await setMessageReadViaApi(id, read);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'İşaretlenemedi.' };
  }
  revalidatePath(adminPath('/messages'));
  return { ok: true };
}

export async function deleteMessage(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    await deleteMessageViaApi(id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Mesaj silinemedi.' };
  }
  revalidatePath(adminPath('/messages'));
  return { ok: true };
}

/**
 * Pushes saved content to the public website. Edits are stored immediately when
 * saved; this is the separate step that makes them visible to visitors.
 */
export async function publishSite(): Promise<PublishResult> {
  await requireAuth();
  try {
    return await publishViaApi();
  } catch (err) {
    return {
      ok: false,
      strategy: 'none',
      at: new Date().toISOString(),
      detail: err instanceof Error ? err.message : 'publish-failed',
      state: 'FAILED',
      id: null,
      actor: null,
      version: null,
    };
  }
}

// ─── Media ──────────────────────────────────────────────────────────────────

export async function getMedia(): Promise<MediaList> {
  await requireAuth();
  try {
    return await readMedia();
  } catch {
    return { files: [], total: 0, usedBytes: 0 };
  }
}

/**
 * Uploads one file.
 *
 * Takes FormData because that is what a file input produces and what the API
 * consumes; converting it to JSON in between would mean base64 and a third copy
 * of a ten-megabyte buffer.
 */
export async function uploadMedia(
  form: FormData,
): Promise<{ ok: boolean; error?: string; file?: MediaFile }> {
  await requireAuth();
  const file = form.get('file');
  const folder = String(form.get('folder') ?? 'uploads') as MediaFolder;

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Dosya seçilmedi.' };
  }
  if (!MEDIA_FOLDERS.includes(folder)) {
    return { ok: false, error: `Geçersiz klasör: ${folder}` };
  }

  try {
    const uploaded = await uploadMediaViaApi(file, folder);
    revalidatePath(adminPath('/media'));
    return { ok: true, file: uploaded };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Yüklenemedi.' };
  }
}

export async function deleteMedia(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    await deleteMediaViaApi(id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Silinemedi.' };
  }
  revalidatePath(adminPath('/media'));
  return { ok: true };
}

/** Publish history: every version, who froze it, and which one is live. */
export async function getVersions(): Promise<ContentVersion[]> {
  await requireAuth();
  try {
    return await readVersions();
  } catch {
    return [];
  }
}

/**
 * Restores a version. The snapshot is written back over the draft and published
 * as a new version, so the history stays append-only and the rollback itself
 * can be rolled back.
 */
export async function restoreVersion(
  number: number,
): Promise<{ ok: boolean; error?: string; version?: number }> {
  await requireAuth();
  try {
    const restored = await restoreVersionViaApi(number);
    revalidatePath(adminPath('/'), 'layout');
    return { ok: true, version: restored.number };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'restore-failed' };
  }
}

export async function getPublishStatus(): Promise<PublishStatus | null> {
  await requireAuth();
  try {
    return await readPublishStatus();
  } catch {
    return null;
  }
}

/**
 * Changes the signed-in operator's password. The API re-checks the current one
 * and revokes every refresh token, so other sessions stop working.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  if (newPassword.length < 8) {
    return { ok: false, error: 'Yeni şifre en az 8 karakter olmalı.' };
  }
  try {
    await changePasswordViaApi(currentPassword, newPassword);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Şifre değiştirilemedi.' };
  }
}

export async function markAllMessagesRead(): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    await markAllMessagesReadViaApi();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'İşaretlenemedi.' };
  }
  revalidatePath(adminPath('/messages'));
  return { ok: true };
}
