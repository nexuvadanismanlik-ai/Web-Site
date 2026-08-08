import type { CSSProperties } from 'react';

/**
 * The picture in the hero when no photograph has been uploaded.
 *
 * The section had a headline, a paragraph and two coloured blurs. Blurs are
 * what a landing page uses when it has nothing to show, and every reader can
 * tell. What Nexuva actually does — running advertising campaigns and
 * reporting on them — has a natural picture, so this draws it.
 *
 * Deliberately without a single number. A mockup carrying figures is a claim,
 * and a claim nobody can check is exactly the invented-results problem the
 * whole project is meant to avoid. This shows the *shape* of the work: a
 * channel filter, a trend, a breakdown, a table of rows. It says "we manage
 * this" without saying "we achieved that".
 *
 * Pure SVG and CSS, no data, no library — it costs nothing to load and nothing
 * to run, which matters because it sits above the fold.
 */
export function CampaignVisual() {
  return (
    <div
      aria-hidden
      className="relative w-full select-none"
      style={{ filter: 'drop-shadow(0 32px 72px rgb(var(--c-overlay) / 0.18))' }}
    >
      {/* Browser chrome. A frame tells the eye this is a screen, which no
          amount of rounded corners on a bare card will do. */}
      <div className="overflow-hidden rounded-[var(--r-lg)] border border-overlay/10 bg-card">
        <div className="flex items-center gap-2 border-b border-overlay/8 px-4 py-3">
          <span className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-overlay/15" />
            <span className="h-2 w-2 rounded-full bg-overlay/15" />
            <span className="h-2 w-2 rounded-full bg-overlay/15" />
          </span>
          <span className="ml-2 h-4 flex-1 rounded-full bg-overlay/[0.06]" />
        </div>

        <div className="grid gap-4 p-4 sm:p-5">
          {/* Channel filters. Named, because these are the channels Nexuva
              actually works in — the only labels here that assert anything,
              and they assert a capability rather than a result. */}
          <div className="flex flex-wrap gap-2">
            {['Google Ads', 'Meta', 'SEO', 'Organik'].map((channel, index) => (
              <span
                key={channel}
                className="rounded-full px-3 py-1 text-[0.7rem] font-medium"
                style={
                  index === 0
                    ? {
                        background: 'color-mix(in srgb, var(--brand) 14%, transparent)',
                        color: 'color-mix(in srgb, var(--brand) 78%, rgb(var(--c-fg)) 22%)',
                      }
                    : {
                        background: 'rgb(var(--c-overlay) / 0.05)',
                        color: 'rgb(var(--c-faint))',
                      }
                }
              >
                {channel}
              </span>
            ))}
          </div>

          {/* Trend. No axis labels and no values: the shape is the message. */}
          <div className="rounded-[var(--r-md)] border border-overlay/8 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="h-2.5 w-24 rounded-full bg-overlay/12" />
              <span className="h-2.5 w-10 rounded-full bg-overlay/8" />
            </div>
            <svg viewBox="0 0 320 96" className="h-24 w-full" role="presentation">
              <defs>
                <linearGradient id="nx-trend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 78 L40 70 L80 74 L120 56 L160 60 L200 38 L240 44 L280 22 L320 14"
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M0 78 L40 70 L80 74 L120 56 L160 60 L200 38 L240 44 L280 22 L320 14 L320 96 L0 96 Z"
                fill="url(#nx-trend)"
              />
              {/* One marked point, in the brand's gold. The only warm note in
                  the picture, so the eye lands where the story ends. */}
              <circle cx="280" cy="22" r="3.5" fill="var(--gold)" />
            </svg>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
            {/* Breakdown */}
            <div className="rounded-[var(--r-md)] border border-overlay/8 p-4">
              <span className="mb-3 block h-2.5 w-20 rounded-full bg-overlay/12" />
              <div className="space-y-2.5">
                {[86, 62, 44, 28].map((width, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="h-1.5 w-10 shrink-0 rounded-full bg-overlay/10" />
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-overlay/[0.06]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${width}%`,
                          background:
                            index === 0
                              ? 'var(--brand)'
                              : 'color-mix(in srgb, var(--brand) 45%, transparent)',
                        }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="rounded-[var(--r-md)] border border-overlay/8 p-4">
              <span className="mb-3 block h-2.5 w-16 rounded-full bg-overlay/12" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="nx-rise flex items-center gap-2.5"
                    style={{ '--nx-delay': `${1200 + row * 110}ms` } as CSSProperties}
                  >
                    <span className="h-5 w-5 shrink-0 rounded-full bg-overlay/[0.07]" />
                    <span className="h-1.5 flex-1 rounded-full bg-overlay/10" />
                    <span className="h-1.5 w-6 shrink-0 rounded-full bg-overlay/[0.07]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
