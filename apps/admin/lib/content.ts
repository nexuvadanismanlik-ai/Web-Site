import { cache } from 'react';
import type { SiteContent, ContactMessage } from '@nexuva/types';
import { WEBSITE_SLUG_BY_KEY, isWebsiteSectionKey } from '@nexuva/shared';
import { apiFetch } from './api';
import type {
  Lead,
  LeadDetail,
  LeadPerson,
  LeadStatus,
  LeadSummary,
  Connection,
  MailSettings,
  MailTemplate,
  MailVariable,
  MailLogEntry,
  AppNotification,
  MediaFile,
  MediaFolder,
  MediaList,
} from './model';

// Shapes and constants live in lib/model, which imports nothing from the
// server — a client component pulling a constant from here would otherwise
// drag next-auth into the browser bundle.
export * from './model';

/**
 * Content access for the admin panel. Everything goes through the Nexuva API,
 * which owns the database — the panel keeps no local copy and never touches
 * content/site.json (that file is now only a seed fixture).
 *
 * The exported read functions keep their original names and shapes so the
 * editor pages did not have to change.
 */

// The CMS vocabulary comes from @nexuva/shared, which the API reads too. Both
// used to keep their own copy, so adding a section here and forgetting there
// produced a section that saved to nothing and reported success.
const isSection = (key: string): boolean => isWebsiteSectionKey(key);
const slugFor = (key: string): string | undefined =>
  WEBSITE_SLUG_BY_KEY[key as keyof typeof WEBSITE_SLUG_BY_KEY];

// ─── Reads ──────────────────────────────────────────────────────────────────

/**
 * Wrapped in React's cache so a layout and the page it renders share one
 * request instead of each making their own. It matters most when the API is
 * waking from idle: three sequential cold calls were turning one page load into
 * minutes.
 */
export const readSiteContent = cache(async (): Promise<SiteContent> => {
  // The panel edits the draft, so it must read the draft. Without state=draft
  // this returns the published snapshot and an editor would be looking at the
  // last publish rather than their own unsaved-to-the-site work.
  //
  // The assembled document is public, so this read needs no bearer token and
  // still works on the login page.
  return apiFetch<SiteContent>('/website/content?state=draft', { auth: false });
});

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

export interface MessageList {
  items: ContactMessage[];
  /** Enquiries in total, not just on this page. */
  total: number;
  /** Counted by the database over the whole table, not over `items`. */
  unread: number;
}

/**
 * A page of enquiries plus the counts the panel displays.
 *
 * The unread count comes from the API. It used to be derived by downloading up
 * to a hundred messages and filtering them in the browser, in three separate
 * places — which is both a wasted transfer and a number that quietly goes wrong
 * the moment there are more messages than the page holds.
 *
 * Cached for the same reason as readSiteContent — the shell and the page both
 * want it, and without this they each made their own request.
 */
export const readMessages = cache(async (limit = 50): Promise<MessageList> => {
  const res = await apiFetch<ApiMessageList>(`/website/contact?limit=${limit}`);
  return {
    items: res.items.map(toContactMessage),
    total: res.meta.total,
    unread: res.meta.unread,
  };
});

// ─── Writes ─────────────────────────────────────────────────────────────────

/**
 * Prepares a collection for the API.
 *
 * The id is kept, and it matters: the API reconciles rows by id, so sending
 * the list without one made every save look like a set of brand-new rows.
 * Position is dropped because array order defines it.
 *
 * An item with no id is new, which is exactly what the editors produce when
 * someone adds a row.
 */
function toApiItems(key: string, value: unknown): Record<string, unknown>[] {
  const list = Array.isArray(value) ? value : [];

  if (key === 'logos') {
    // Logos are plain strings in SiteContent but rows with a name in the API.
    // With no id to carry, the API matches them positionally on save.
    return list.map((name) => ({ name: String(name) }));
  }

  return list.map((raw) => {
    const item = { ...(raw as Record<string, unknown>) };
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
  if (isSection(key)) {
    await apiFetch(`/website/sections/${key}`, {
      method: 'PUT',
      body: JSON.stringify(value),
    });
    return;
  }

  const slug = slugFor(key);
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
  if (isSection(root)) {
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
  const slug = slugFor(root);
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

/** One request, whatever the inbox size. */
export async function markAllMessagesReadViaApi(): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/website/contact/read-all', { method: 'PATCH' });
}

// ─── Publishing ─────────────────────────────────────────────────────────────

/** PENDING while a triggered rebuild is still running. */
export type PublishState = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface PublishResult {
  ok: boolean;
  strategy: 'deploy-hook' | 'revalidate' | 'none';
  at: string;
  detail: string;
  state: PublishState;
  id: string | null;
  /** Who pressed Publish. Null for an automatic one. */
  actor: string | null;
  /** Content version this publish carried, once one was frozen. */
  version: number | null;
  /** When the attempt began; `at` is when it settled. */
  startedAt: string;
  finishedAt: string | null;
  /** Null while the build is still running. */
  durationMs: number | null;
  /** Identifier from the deploy provider, for finding the build directly. */
  deployId: string | null;
}

export interface PublishStatus {
  strategy: 'deploy-hook' | 'revalidate' | 'none';
  configured: boolean;
  pendingChanges: boolean;
  lastChangeAt: string | null;
  lastPublish: PublishResult | null;
  /** A rebuild is in flight — saying "Yayınlandı" yet would be premature. */
  publishInProgress: boolean;
  /** False when deploy outcomes cannot be read back, so results stay unknown. */
  outcomeTracking: boolean;
  history: PublishResult[];
}

// ─── CRM ────────────────────────────────────────────────────────────────────

/** A filtered page of leads. Query is built by the caller. */
export async function readLeads(query: string): Promise<{ items: Lead[]; total: number }> {
  const res = await apiFetch<{ items: Lead[]; meta: { total: number } }>(
    `/website/contact?${query}`,
  );
  return { items: res.items, total: res.meta.total };
}

export async function readPipelineCounts(): Promise<Record<LeadStatus, number>> {
  return apiFetch<Record<LeadStatus, number>>('/website/contact/pipeline/counts');
}

export async function createLeadViaApi(payload: Record<string, unknown>): Promise<LeadDetail> {
  return apiFetch<LeadDetail>('/website/contact/leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function readConnections(): Promise<{ connections: Connection[]; checkedAt: string }> {
  return apiFetch<{ connections: Connection[]; checkedAt: string }>('/health/connections');
}

export async function readLeadSummary(): Promise<LeadSummary> {
  return apiFetch<LeadSummary>('/website/contact/pipeline/summary');
}

export async function readAssignees(): Promise<LeadPerson[]> {
  return apiFetch<LeadPerson[]>('/website/contact/pipeline/assignees');
}

export async function readLeadDetail(id: string): Promise<LeadDetail> {
  return apiFetch<LeadDetail>(`/website/contact/${id}/detail`);
}

export async function setLeadStatusViaApi(id: string, status: LeadStatus): Promise<LeadDetail> {
  return apiFetch<LeadDetail>(`/website/contact/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function assignLeadViaApi(id: string, userId: string | null): Promise<LeadDetail> {
  return apiFetch<LeadDetail>(`/website/contact/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ userId }),
  });
}

export async function addLeadNoteViaApi(id: string, body: string): Promise<LeadDetail> {
  return apiFetch<LeadDetail>(`/website/contact/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function removeLeadNoteViaApi(noteId: string): Promise<LeadDetail> {
  return apiFetch<LeadDetail>(`/website/contact/notes/${noteId}`, { method: 'DELETE' });
}

export async function setLeadTagsViaApi(id: string, tags: string[]): Promise<LeadDetail> {
  return apiFetch<LeadDetail>(`/website/contact/${id}/tags`, {
    method: 'PATCH',
    body: JSON.stringify({ tags }),
  });
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function readNotifications(unreadOnly = false): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>(`/notifications?unreadOnly=${unreadOnly}`);
}

export async function markNotificationReadViaApi(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsReadViaApi(): Promise<void> {
  await apiFetch('/notifications/read-all', { method: 'PATCH' });
}

// ─── Media ──────────────────────────────────────────────────────────────────

interface ApiFileList {
  files: MediaFile[];
  pagination: { total: number; limit: number; offset: number };
  usage: { totalBytes: number; totalMB: number };
}

/**
 * A page of uploaded files.
 *
 * Addressed by tenant slug rather than id: the panel knows the slug and the
 * storage endpoints previously only accepted an id, which is why nothing in the
 * admin could reach them.
 */
export async function readMedia(limit = 100, offset = 0): Promise<MediaList> {
  const res = await apiFetch<ApiFileList>(
    `/storage/files?tenant=&limit=${limit}&offset=${offset}`,
  );
  return {
    files: res.files,
    total: res.pagination.total,
    usedBytes: res.usage.totalBytes,
  };
}

export async function deleteMediaViaApi(id: string): Promise<void> {
  await apiFetch(`/storage/files/${id}`, { method: 'DELETE' });
}

export async function uploadMediaViaApi(file: File, folder: MediaFolder): Promise<MediaFile> {
  const body = new FormData();
  body.append('file', file);
  return apiFetch<MediaFile>(`/storage/upload?tenant=&folder=${folder}`, {
    method: 'POST',
    body,
  });
}

/** One entry in the content history. Snapshots are not carried in the list. */
export interface ContentVersion {
  id: string;
  number: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  note: string | null;
  /** Set when this version was produced by restoring an earlier one. */
  restoredFrom: number | null;
}

export async function readVersions(limit = 20): Promise<ContentVersion[]> {
  return apiFetch<ContentVersion[]>(`/website/versions?limit=${limit}`);
}

export async function restoreVersionViaApi(number: number): Promise<ContentVersion> {
  return apiFetch<ContentVersion>(`/website/versions/${number}/restore`, { method: 'POST' });
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

// ─── Mail ───────────────────────────────────────────────────────────────────

export async function readMailSettings(): Promise<MailSettings> {
  return apiFetch<MailSettings>('/mail/settings');
}

export async function saveMailSettingsViaApi(
  payload: Record<string, unknown>,
): Promise<MailSettings> {
  return apiFetch<MailSettings>('/mail/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function sendTestMailViaApi(
  to: string,
  templateKey?: string,
): Promise<{ ok: boolean; provider: string; detail: string }> {
  return apiFetch<{ ok: boolean; provider: string; detail: string }>('/mail/test', {
    method: 'POST',
    body: JSON.stringify({ to, ...(templateKey ? { templateKey } : {}) }),
  });
}

export async function readMailTemplates(): Promise<{
  templates: MailTemplate[];
  variables: MailVariable[];
}> {
  return apiFetch<{ templates: MailTemplate[]; variables: MailVariable[] }>('/mail/templates');
}

export async function saveMailTemplateViaApi(
  key: string,
  payload: { subject?: string; body?: string; enabled?: boolean },
): Promise<MailTemplate> {
  return apiFetch<MailTemplate>(`/mail/templates/${key}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function readMailPreview(key: string): Promise<{ subject: string; html: string }> {
  return apiFetch<{ subject: string; html: string }>(`/mail/templates/${key}/preview`);
}

export async function readMailLogs(): Promise<{ items: MailLogEntry[]; failed: number }> {
  return apiFetch<{ items: MailLogEntry[]; failed: number }>('/mail/logs');
}
