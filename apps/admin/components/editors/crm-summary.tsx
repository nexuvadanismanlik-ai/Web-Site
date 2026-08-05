import { AlertCircle, CalendarDays, Inbox, Percent, ThumbsDown, Trophy } from 'lucide-react';
import type { LeadSummary } from '../../lib/model';

/**
 * The CRM overview, above the board.
 *
 * A server component with no interactivity on purpose: it is six numbers, and
 * shipping a client component to render them would put JavaScript in the
 * browser to display text that never changes after the page loads.
 *
 * The numbers come from the database rather than from the board's own list,
 * which is capped at a hundred rows — a total that stops being true at the
 * hundred-and-first enquiry is worse than no total.
 */
export function CrmSummary({ summary }: { summary: LeadSummary }) {
  const tiles = [
    {
      label: 'Açık talep',
      value: summary.open,
      hint:
        summary.awaitingFirstTouch > 0
          ? `${summary.awaitingFirstTouch} tanesi henüz açılmadı`
          : 'Hepsi ele alındı',
      icon: Inbox,
      alert: false,
    },
    {
      label: 'Bu hafta gelen',
      value: summary.thisWeek,
      hint: 'Son 7 gün',
      icon: CalendarDays,
      alert: false,
    },
    {
      label: 'Atanmamış',
      value: summary.unassigned,
      hint: summary.unassigned > 0 ? 'Sahibi yok' : 'Tamamı atandı',
      icon: AlertCircle,
      // The one number on this row that is a job to do rather than a fact.
      alert: summary.unassigned > 0,
    },
    { label: 'Kazanıldı', value: summary.won, hint: 'Tüm zamanlar', icon: Trophy, alert: false },
    {
      label: 'Kaybedildi',
      value: summary.lost,
      hint: 'Tüm zamanlar',
      icon: ThumbsDown,
      alert: false,
    },
    {
      label: 'Kazanma oranı',
      // Null means nothing has been decided yet. Showing 0% would claim a
      // result that has not happened.
      value: summary.winRate === null ? '—' : `%${summary.winRate}`,
      hint: summary.winRate === null ? 'Henüz sonuçlanan talep yok' : 'Kazanılan / sonuçlanan',
      icon: Percent,
      alert: false,
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div key={tile.label} className="ui-panel p-4">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                tile.alert ? 'bg-amber-500/15 text-amber-500' : 'bg-overlay/5 text-brand-dyn'
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="mt-3 font-heading text-2xl font-bold text-fg">{tile.value}</div>
            <div className="mt-0.5 text-xs font-medium text-muted">{tile.label}</div>
            <div className="mt-1 text-[11px] text-faint">{tile.hint}</div>
          </div>
        );
      })}
    </div>
  );
}
