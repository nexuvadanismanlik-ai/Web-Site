'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { ANALYTICS_RANGES, type AnalyticsRange } from '../../lib/model';

/**
 * The window the analytics screen is read over.
 *
 * Kept in the address rather than in component state, so a range survives a
 * refresh and can be sent to somebody else. The page is a server component
 * that reads the same two parameters, which is why this only has to navigate.
 */
export function AnalyticsRangePicker({
  selected,
  from,
  to,
}: {
  selected: AnalyticsRange;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function choose(range: AnalyticsRange) {
    const next = new URLSearchParams(params.toString());
    next.set('range', range);
    // The custom dates stay in the address while another range is selected, so
    // going back to "Özel aralık" does not lose what somebody typed.
    router.push(`?${next.toString()}`);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    const next = new URLSearchParams(params.toString());
    next.set('range', 'custom');
    // Swapped rather than refused: picking the end date first is a slip, not a
    // mistake worth an error message.
    next.set('from', customFrom <= customTo ? customFrom : customTo);
    next.set('to', customFrom <= customTo ? customTo : customFrom);
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {ANALYTICS_RANGES.map((range) => (
          <button
            key={range.value}
            onClick={() => choose(range.value)}
            aria-pressed={selected === range.value}
            className={
              selected === range.value
                ? 'rounded-lg bg-overlay/10 px-3 py-1.5 text-xs font-medium text-fg'
                : 'rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-overlay/5 hover:text-fg'
            }
          >
            {range.label}
          </button>
        ))}
      </div>

      {selected === 'custom' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">
            <span className="mb-1 block">Başlangıç</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="rounded-lg border border-overlay/15 bg-transparent px-2.5 py-1.5 text-sm text-fg"
            />
          </label>
          <label className="text-xs text-muted">
            <span className="mb-1 block">Bitiş</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(event) => setCustomTo(event.target.value)}
              className="rounded-lg border border-overlay/15 bg-transparent px-2.5 py-1.5 text-sm text-fg"
            />
          </label>
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
            className="flex items-center gap-1.5 rounded-lg bg-overlay/10 px-3 py-1.5 text-xs font-medium text-fg hover:bg-overlay/15 disabled:opacity-40"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Uygula
          </button>
        </div>
      )}
    </div>
  );
}
