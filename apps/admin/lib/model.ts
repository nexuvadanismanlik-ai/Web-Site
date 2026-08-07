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
  /** How this enquiry found us, from the visitor's own session. */
  source?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  landingPath?: string | null;
  referrer?: string | null;
  device?: string | null;
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

/** One field that differs between two versions. */
export interface ContentChange {
  /** Where it is, in the panel's words: "Hero → Başlık". */
  label: string;
  path: string[];
  kind: 'added' | 'removed' | 'changed';
  before: string | null;
  after: string | null;
}

export interface ContentDiff {
  from: number;
  /** Null means "compared against the current draft". */
  to: number | null;
  changes: ContentChange[];
  /** True when more changed than the list shows. */
  truncated: boolean;
  total: number;
}

/** Folders the API accepts. Anything else is rejected as path traversal. */
export const MEDIA_FOLDERS = ['images', 'logos', 'documents', 'attachments', 'uploads'] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

/** One place on the site that points at a file. */
export interface MediaUsage {
  /** What the panel calls that screen. */
  label: string;
  /** Where to go to change it. */
  href: string;
  /** Which row, when the place is a list. */
  detail?: string;
}

export interface MediaFile {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  folder: string;
  createdAt: string;
  /** Everywhere this file appears on the site. Empty means safe to delete. */
  usedAt?: MediaUsage[];
}

export interface MediaList {
  files: MediaFile[];
  /** Files in total, not just on this page. */
  total: number;
  usedBytes: number;
}

// ─── Mail ───────────────────────────────────────────────────────────────────

export const MAIL_PROVIDERS = [
  { value: 'resend', label: 'Resend' },
  { value: 'smtp', label: 'SMTP (Gmail, Microsoft, kendi sunucun)' },
  { value: 'sendgrid', label: 'SendGrid' },
] as const;

/**
 * Mail configuration as the panel may see it.
 *
 * Secrets are absent by design: they go in and never come back, so the two
 * `has…` flags are all the screen knows and all it needs.
 */
export interface MailSettings {
  provider: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  notifyTo: string;
  hasApiKey: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  hasSmtpPassword: boolean;
  smtpSecure: boolean;
  /** False when the values still come from the server environment. */
  fromDatabase: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
}

export interface MailTemplate {
  id: string;
  key: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  enabled: boolean;
}

export interface MailVariable {
  key: string;
  label: string;
}

export interface MailLogEntry {
  id: string;
  to: string;
  subject: string;
  templateKey: string | null;
  provider: string;
  status: 'SENT' | 'FAILED';
  error: string | null;
  createdAt: string;
}

// ─── Analytics ──────────────────────────────────────────────────────────────

/** The ranges the analytics screen offers, and what each means in days. */
export const ANALYTICS_RANGES = [
  { value: 'today', label: 'Bugün' },
  { value: 'yesterday', label: 'Dün' },
  { value: '7', label: 'Son 7 gün' },
  { value: '30', label: 'Son 30 gün' },
  { value: '90', label: 'Son 90 gün' },
  { value: 'custom', label: 'Özel aralık' },
] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]['value'];

export interface AnalyticsSummary {
  /** The window the figures below were measured over. */
  range: { from: string; to: string; days: number };
  /**
   * `today`/`week`/`month` are fixed reference points, so "bugün" means today
   * whatever range is selected. `selected` is the chosen range.
   */
  visitors: { today: number; week: number; month: number; selected: number };
  views: { today: number; week: number; month: number; selected: number };
  /** Null when nobody has visited yet — a rate over no visitors is unknown. */
  conversionRate: number | null;
  formSubmits: number;
  ctaClicks: number;
  averageSeconds: number;
  topPages: { path: string; views: number }[];
  sources: { source: string; views: number }[];
  devices: { device: string; views: number }[];
  /** One entry per day, gaps filled with zeros. */
  daily: { date: string; views: number; visitors: number }[];
  /** What each campaign produced: visits, enquiries, won work. */
  campaigns: {
    source: string;
    campaign: string;
    visitors: number;
    views: number;
    leads: number;
    won: number;
    conversionRate: number | null;
  }[];
  crm: {
    leads: number;
    won: number;
    lost: number;
    /** Null until something has been decided. */
    winRate: number | null;
    /** Visitors that became enquiries, as a percentage. */
    leadRate: number | null;
  };
}

// ─── Panel preferences ──────────────────────────────────────────────────────

/**
 * Settings that change how the panel reads its data, not what the site says.
 * Not versioned and not published: changing the timezone should take effect on
 * the next report, not on the next deploy.
 */
export interface SitePreferences {
  /** IANA name. Decides where a reporting day starts. */
  timezone: string;
}
