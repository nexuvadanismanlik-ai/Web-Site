/**
 * Shapes and constants shared by server and browser code.
 *
 * Separate from lib/content.ts on purpose. That module reaches the API, so it
 * imports lib/api.ts, which reads the session through next-auth — and a client
 * component importing a single constant from it pulled the whole server auth
 * stack into the browser bundle. The CRM and media screens weighed 366 kB
 * against a 300 kB budget for exactly that reason.
 *
 * Nothing here may import anything with a runtime dependency on the server.
 */

// ─── CRM ────────────────────────────────────────────────────────────────────

export const LEAD_STATUSES = [
  'NEW',
  'REVIEWING',
  'CONTACTED',
  'PROPOSAL_SENT',
  'MEETING',
  'WAITING',
  'WON',
  'LOST',
  'ARCHIVED',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface Lead {
  id: string;
  requestNo: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  service: string | null;
  budget: string | null;
  subject: string | null;
  message?: string;
  status: LeadStatus;
  tags: string[];
  isRead: boolean;
  createdAt: string;
  lastActionAt: string;
  assignedTo: LeadPerson | null;
}

export interface LeadNote {
  id: string;
  body: string;
  createdAt: string;
  author: LeadPerson | null;
}

export interface LeadActivity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  actor: LeadPerson | null;
}

export interface LeadFile {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface LeadDetail extends Lead {
  message: string;
  consentAt: string | null;
  notes: LeadNote[];
  activities: LeadActivity[];
  files: LeadFile[];
}

/** Display name for a person, falling back to the address. */
export function personName(person: LeadPerson | null): string {
  if (!person) return '';
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ');
  return name || person.email;
}

// ─── Notifications ──────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
  metadata?: { leadId?: string } | null;
}

/**
 * Headline numbers for the CRM overview, counted by the database.
 *
 * `winRate` is null when nothing has been won or lost yet — a rate over no
 * decisions is unknown, not zero, and the screen shows it as such.
 */
export interface LeadSummary {
  open: number;
  unassigned: number;
  awaitingFirstTouch: number;
  thisWeek: number;
  won: number;
  lost: number;
  winRate: number | null;
}

// ─── System ─────────────────────────────────────────────────────────────────

export type ConnectionState = 'connected' | 'broken' | 'missing';

export interface Connection {
  key: string;
  label: string;
  state: ConnectionState;
  detail: string;
  /** Environment variables that would fix a missing connection. */
  missing?: string[];
}

/**
 * What the panel knows about the platform it is running on.
 *
 * `apiReachable` is separate from the connection list on purpose: when the API
 * is down there is no list, and that is exactly the moment somebody opens this
 * screen. A page that renders nothing at the only time it matters is not a
 * status page.
 */
export interface SystemStatus {
  apiReachable: boolean;
  apiUrl: string;
  apiDetail: string;
  connections: Connection[];
  checkedAt: string;
}

// ─── Media ──────────────────────────────────────────────────────────────────

/** Folders the API accepts. Anything else is rejected as path traversal. */
export const MEDIA_FOLDERS = ['images', 'logos', 'documents', 'attachments', 'uploads'] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export interface MediaFile {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  folder: string;
  createdAt: string;
}

export interface MediaList {
  files: MediaFile[];
  /** Files in total, not just on this page. */
  total: number;
  usedBytes: number;
}
