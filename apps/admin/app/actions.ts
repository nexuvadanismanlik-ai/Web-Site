'use server';

import { revalidatePath } from 'next/cache';
import type { SiteContent } from '@nexuva/types';
import { getSession } from '../lib/session';
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
  readDiff,
  readVersions,
  restoreVersionViaApi,
  readMedia,
  uploadMediaViaApi,
  deleteMediaViaApi,
  MEDIA_FOLDERS,
  readLeads,
  readPipelineCounts,
  readLeadSummary,
  readConnections,
  readMailSettings,
  saveMailSettingsViaApi,
  sendTestMailViaApi,
  readMailTemplates,
  saveMailTemplateViaApi,
  readMailPreview,
  readMailLogs,
  readAnalytics,
  readSitePreferences,
  saveSitePreferencesViaApi,
  createLeadViaApi,
  readAssignees,
  readLeadDetail,
  setLeadStatusViaApi,
  assignLeadViaApi,
  addLeadNoteViaApi,
  removeLeadNoteViaApi,
  setLeadTagsViaApi,
  readNotifications,
  markNotificationReadViaApi,
  markAllNotificationsReadViaApi,
  type Lead,
  type LeadDetail,
  type LeadPerson,
  type LeadStatus,
  type LeadSummary,
  type SystemStatus,
  type MailSettings,
  type MailTemplate,
  type MailVariable,
  type MailLogEntry,
  type AnalyticsSummary,
  type AppNotification,
  type MediaList,
  type MediaFile,
  type MediaFolder,
  type PublishResult,
  type PublishStatus,
  type ContentVersion,
  type ContentDiff,
  type SitePreferences,
} from '../lib/content';

// Resolved from the per-request cache, so thirty-two call sites cost one
// session decrypt rather than thirty-two — see lib/session.
async function requireAuth() {
  const session = await getSession();
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
      // The attempt never reached the API, so it has no recorded span and no
      // deploy behind it. Reported as zero rather than omitted, so the screen
      // does not have to special-case a result that failed before it started.
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      deployId: null,
    };
  }
}

// ─── System ─────────────────────────────────────────────────────────────────

/** Where this panel expects to find the API. Same value lib/api.ts uses. */
const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

/**
 * The state of every connection the platform depends on.
 *
 * Probes the API from this server first, and reports that separately. When the
 * API is down there is no connection list to fetch — and that is precisely when
 * somebody opens this screen, so "we could not reach the API, here is the
 * address we tried" has to be an answer the page can render rather than an
 * error boundary.
 *
 * The probe is short and unauthenticated: /health is public, and waiting 75
 * seconds for the usual wake-up retry would make a status page feel broken too.
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  await requireAuth();

  let apiReachable = false;
  let apiDetail = '';
  const started = Date.now();

  try {
    const res = await fetch(`${API_BASE}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    apiReachable = res.ok;
    apiDetail = res.ok
      ? `Yanıt ${Date.now() - started} ms.`
      : `HTTP ${res.status} döndü. Servis ayakta değil ya da adres yanlış.`;
  } catch (err) {
    apiDetail =
      err instanceof Error && err.name === 'TimeoutError'
        ? 'Zaman aşımı. Servis uykuda olabilir; birkaç saniye sonra tekrar deneyin.'
        : 'Bağlantı kurulamadı. Servis çalışmıyor ya da adres yanlış.';
  }

  if (!apiReachable) {
    return { apiReachable, apiUrl: API_BASE, apiDetail, connections: [], checkedAt: new Date().toISOString() };
  }

  try {
    const report = await readConnections();
    return { apiReachable, apiUrl: API_BASE, apiDetail, ...report };
  } catch (err) {
    return {
      apiReachable,
      apiUrl: API_BASE,
      apiDetail: `API yanıt veriyor ama bağlantı raporu alınamadı: ${
        err instanceof Error ? err.message : 'bilinmeyen hata'
      }`,
      connections: [],
      checkedAt: new Date().toISOString(),
    };
  }
}

// ─── CRM ────────────────────────────────────────────────────────────────────

/** Everything the pipeline screen needs, in one round trip. */
export async function getPipeline(): Promise<{
  counts: Record<LeadStatus, number>;
  assignees: LeadPerson[];
}> {
  await requireAuth();
  const [counts, assignees] = await Promise.all([
    readPipelineCounts().catch(() => ({}) as Record<LeadStatus, number>),
    readAssignees().catch(() => []),
  ]);
  return { counts, assignees };
}

/** The CRM overview numbers. Zeros rather than a crash if the API is unreachable. */
export async function getLeadSummary(): Promise<LeadSummary> {
  await requireAuth();
  try {
    return await readLeadSummary();
  } catch {
    return {
      open: 0,
      unassigned: 0,
      awaitingFirstTouch: 0,
      thisWeek: 0,
      won: 0,
      lost: 0,
      winRate: null,
    };
  }
}

/**
 * Records a lead somebody took down by hand.
 *
 * Empty strings are dropped rather than sent: the form uses '' for "not
 * stated", and the API would store that as an answer of "".
 */
export async function createLead(input: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  service?: string;
  budget?: string;
  message: string;
  status?: LeadStatus;
  assignedToId?: string;
  source?: string;
}): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim() === '') continue;
    if (value === undefined) continue;
    payload[key] = value;
  }

  try {
    await createLeadViaApi(payload);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Talep eklenemedi.' };
  }
  revalidatePath(adminPath('/crm'));
  revalidatePath(adminPath('/'), 'layout');
  return { ok: true };
}

export async function getLeads(params: {
  status?: LeadStatus;
  assignedTo?: string;
  search?: string;
}): Promise<{ items: Lead[]; total: number }> {
  await requireAuth();
  const query = new URLSearchParams({ limit: '100', sortBy: 'lastActionAt', sortOrder: 'desc' });
  if (params.status) query.set('status', params.status);
  if (params.assignedTo) query.set('assignedTo', params.assignedTo);
  if (params.search) query.set('search', params.search);

  try {
    const res = await readLeads(query.toString());
    return res;
  } catch {
    return { items: [], total: 0 };
  }
}

export async function getLead(id: string): Promise<LeadDetail | null> {
  await requireAuth();
  try {
    return await readLeadDetail(id);
  } catch {
    return null;
  }
}

type LeadResult = { ok: boolean; error?: string; lead?: LeadDetail };

async function leadAction(fn: () => Promise<LeadDetail>, failure: string): Promise<LeadResult> {
  await requireAuth();
  try {
    const lead = await fn();
    revalidatePath(adminPath('/crm'));
    return { ok: true, lead };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : failure };
  }
}

export async function setLeadStatus(id: string, status: LeadStatus): Promise<LeadResult> {
  return leadAction(() => setLeadStatusViaApi(id, status), 'Durum değiştirilemedi.');
}

export async function assignLead(id: string, userId: string | null): Promise<LeadResult> {
  return leadAction(() => assignLeadViaApi(id, userId), 'Atama yapılamadı.');
}

export async function addLeadNote(id: string, body: string): Promise<LeadResult> {
  return leadAction(() => addLeadNoteViaApi(id, body), 'Not eklenemedi.');
}

export async function removeLeadNote(noteId: string): Promise<LeadResult> {
  return leadAction(() => removeLeadNoteViaApi(noteId), 'Not silinemedi.');
}

export async function setLeadTags(id: string, tags: string[]): Promise<LeadResult> {
  return leadAction(() => setLeadTagsViaApi(id, tags), 'Etiketler kaydedilemedi.');
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function getNotifications(unreadOnly = false): Promise<AppNotification[]> {
  await requireAuth();
  try {
    return await readNotifications(unreadOnly);
  } catch {
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    await markNotificationReadViaApi(id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'İşaretlenemedi.' };
  }
  revalidatePath(adminPath('/'), 'layout');
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    await markAllNotificationsReadViaApi();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'İşaretlenemedi.' };
  }
  revalidatePath(adminPath('/'), 'layout');
  return { ok: true };
}

// ─── Media ──────────────────────────────────────────────────────────────────

/**
 * The uploaded files. `withUsage` also reports where each one appears on the
 * site — six extra queries, so only the media library asks for it.
 */
export async function getMedia(withUsage = false): Promise<MediaList> {
  await requireAuth();
  try {
    return await readMedia(100, 0, withUsage);
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

export async function deleteMedia(
  id: string,
  force = false,
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    await deleteMediaViaApi(id, force);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Silinemedi.' };
  }
  revalidatePath(adminPath('/media'));
  return { ok: true };
}

/**
 * What changed between a version and another — or, with no second version,
 * between it and the current draft. Returns null rather than throwing: the
 * comparison is extra information on a screen that works without it.
 */
export async function getDiff(from: number, to?: number): Promise<ContentDiff | null> {
  await requireAuth();
  try {
    return await readDiff(from, to);
  } catch {
    return null;
  }
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

// ─── Mail ───────────────────────────────────────────────────────────────────

export async function getMailSettings(): Promise<MailSettings | null> {
  await requireAuth();
  try {
    return await readMailSettings();
  } catch {
    return null;
  }
}

export async function saveMailSettings(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; settings?: MailSettings }> {
  await requireAuth();
  try {
    const settings = await saveMailSettingsViaApi(payload);
    revalidatePath(adminPath('/mail'));
    return { ok: true, settings };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Kaydedilemedi.' };
  }
}

/**
 * Sends a real message and reports what the provider said.
 *
 * The error text is passed through untouched: "domain is not verified" is the
 * answer, and any paraphrase of it is worse.
 */
export async function sendTestMail(
  to: string,
  templateKey?: string,
): Promise<{ ok: boolean; detail: string }> {
  await requireAuth();
  try {
    const result = await sendTestMailViaApi(to, templateKey);
    revalidatePath(adminPath('/mail'));
    return { ok: result.ok, detail: result.detail };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'Gönderilemedi.' };
  }
}

export async function getMailTemplates(): Promise<{
  templates: MailTemplate[];
  variables: MailVariable[];
}> {
  await requireAuth();
  try {
    return await readMailTemplates();
  } catch {
    return { templates: [], variables: [] };
  }
}

export async function saveMailTemplate(
  key: string,
  payload: { subject?: string; body?: string; enabled?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    await saveMailTemplateViaApi(key, payload);
    revalidatePath(adminPath('/mail'));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Kaydedilemedi.' };
  }
}

export async function getMailPreview(
  key: string,
): Promise<{ subject: string; html: string } | null> {
  await requireAuth();
  try {
    return await readMailPreview(key);
  } catch {
    return null;
  }
}

export async function getMailLogs(): Promise<{ items: MailLogEntry[]; failed: number }> {
  await requireAuth();
  try {
    return await readMailLogs();
  } catch {
    return { items: [], failed: 0 };
  }
}

// ─── Analytics ──────────────────────────────────────────────────────────────

/** Zeros rather than a crash: an empty chart is a truer answer than an error. */
export async function getAnalytics(
  from?: string,
  to?: string,
): Promise<AnalyticsSummary | null> {
  await requireAuth();
  try {
    return await readAnalytics(from, to);
  } catch {
    return null;
  }
}

// ─── Panel preferences ──────────────────────────────────────────────────────

/**
 * Preferences that change how the panel reads its data. Not versioned and not
 * published — a timezone change should show up in the next report, not after a
 * deploy.
 */
export async function getSitePreferences(): Promise<
  (SitePreferences & { options: string[] }) | null
> {
  await requireAuth();
  try {
    return await readSitePreferences();
  } catch {
    return null;
  }
}

export async function saveSitePreferences(
  input: Partial<SitePreferences>,
): Promise<{ ok: boolean; error?: string }> {
  await requireAuth();
  try {
    await saveSitePreferencesViaApi(input);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Kaydedilemedi.' };
  }
  revalidatePath(adminPath('/settings'));
  revalidatePath(adminPath('/analytics'));
  return { ok: true };
}
