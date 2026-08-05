import type { LeadStatus } from '../../lib/model';

/** Turkish names for the pipeline stages. One place, used by every CRM screen. */
export const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Yeni',
  REVIEWING: 'İnceleniyor',
  CONTACTED: 'İletişime geçildi',
  PROPOSAL_SENT: 'Teklif gönderildi',
  MEETING: 'Görüşme',
  WAITING: 'Bekliyor',
  WON: 'Kazanıldı',
  LOST: 'Kaybedildi',
  ARCHIVED: 'Arşiv',
};

/**
 * Column accent per stage. Won and lost are the two an eye should find without
 * reading; the rest stay neutral so the board does not become a rainbow.
 */
export const STATUS_ACCENT: Record<LeadStatus, string> = {
  NEW: 'border-brand-400/50',
  REVIEWING: 'border-overlay/15',
  CONTACTED: 'border-overlay/15',
  PROPOSAL_SENT: 'border-overlay/15',
  MEETING: 'border-overlay/15',
  WAITING: 'border-amber-500/40',
  WON: 'border-green-500/50',
  LOST: 'border-red-500/40',
  ARCHIVED: 'border-overlay/10',
};
