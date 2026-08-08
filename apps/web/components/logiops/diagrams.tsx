import type { CSSProperties } from 'react';

/**
 * The pictures on the LogiOps page.
 *
 * Diagrams rather than photographs, and the brief is explicit about why: a
 * lorry at sunset says "logistics website" and nothing about the product. What
 * this product does is put scattered work into one file, and that is a shape —
 * so it is drawn as one.
 *
 * No invented screenshots either. Where a real interface would go, these show
 * structure: a file with things attached to it, a flow with steps, a network
 * with nodes. They are honest about being diagrams, which a fake UI is not.
 *
 * All SVG and CSS. Nothing here loads a byte over the network.
 */

/** Shared node styling, so eight diagrams read as one hand. */
const chip =
  'rounded-[var(--r-sm)] border border-overlay/12 bg-card px-3 py-2 text-xs font-medium text-muted';

/**
 * Before and after.
 *
 * The scattered row is deliberately ugly — seven tools with arrows between
 * them, which is what the reader's Tuesday looks like. The single file below
 * it has to feel like relief, and it only does if the thing above it does not.
 */
export function ScatteredVsFile() {
  const tools = ['Mail', 'Excel', 'ERP', 'WhatsApp', 'Muhasebe', 'Evrak', 'Telefon'];

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-faint">
          Bugün
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {tools.map((tool, index) => (
            <span key={tool} className="flex items-center gap-2">
              <span className={chip}>{tool}</span>
              {index < tools.length - 1 && (
                <span aria-hidden className="text-faint">
                  →
                </span>
              )}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-faint">
          Aynı bilgi her araçta yeniden giriliyor; hiçbiri diğerini bilmiyor.
        </p>
      </div>

      <div className="rule-gold w-full" aria-hidden />

      <div>
        <p className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-faint">
          LogiOps ile
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {['Tek Dosya', 'Tek Timeline', 'Tek Operasyon'].map((label, index) => (
            <span key={label} className="flex items-center gap-2">
              <span
                className="rounded-[var(--r-sm)] px-3 py-2 text-xs font-semibold"
                style={{
                  border: '1px solid color-mix(in srgb, var(--gold) 45%, transparent)',
                  color: 'rgb(var(--c-fg))',
                }}
              >
                {label}
              </span>
              {index < 2 && (
                <span aria-hidden style={{ color: 'var(--gold)' }}>
                  →
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The operation file, with everything that hangs off it.
 *
 * Laid out as a ring because the point is that none of these is downstream of
 * another — they all attach to the same record. A vertical list would say
 * "stages", which is the misreading the brief warns against.
 */
export function OperationFileOrbit() {
  const attached = [
    'AWB',
    'Master AWB',
    'Bill of Lading',
    'CMR',
    'Manifest',
    'Fatura',
    'Muhasebe',
    'Mail',
    'Doküman',
    'Saha',
    'Talepler',
    'Timeline',
  ];

  return (
    <div className="rounded-[var(--r-lg)] border border-overlay/10 bg-card p-6 sm:p-10">
      <div className="mx-auto max-w-md text-center">
        <div
          className="mx-auto inline-flex flex-col items-center rounded-[var(--r-md)] px-6 py-5"
          style={{
            border: '1px solid var(--gold)',
            background: 'color-mix(in srgb, var(--gold) 6%, transparent)',
          }}
        >
          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-faint">
            Operasyon Dosyası
          </span>
          <span className="mt-1 font-heading text-2xl text-fg">235-4458-4458</span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {attached.map((item, index) => (
          <div
            key={item}
            className="nx-rise flex items-center gap-2 rounded-[var(--r-sm)] border border-overlay/10 px-3 py-2.5"
            style={{ '--nx-delay': `${index * 60}ms` } as CSSProperties}
          >
            <span
              aria-hidden
              className="h-1 w-1 shrink-0 rounded-full"
              style={{ background: 'var(--gold)' }}
            />
            <span className="truncate text-xs text-muted">{item}</span>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-faint">
        Bilgi bir kez oluşturulur, ilgili süreçlerde yeniden kullanılır.
      </p>
    </div>
  );
}

/**
 * A vertical flow with a connecting line.
 *
 * Used for the sequences the brief describes — how it works, live data,
 * customer portal. One component, three uses: the alternative was three
 * near-identical blocks that would drift apart.
 */
export function FlowDiagram({
  steps,
  accent = false,
}: {
  steps: { title: string; body?: string }[];
  accent?: boolean;
}) {
  const colour = accent ? 'var(--gold)' : 'var(--brand)';

  return (
    <ol className="relative border-l border-overlay/12 pl-8 sm:pl-10">
      {steps.map((step) => (
        <li key={step.title} className="relative pb-8 last:pb-0">
          <span
            aria-hidden
            className="absolute -left-[calc(2rem+1px)] top-1 flex h-4 w-4 items-center justify-center rounded-full sm:-left-[calc(2.5rem+1px)]"
            style={{ background: 'rgb(var(--c-page))', border: `1px solid ${colour}` }}
          />
          <h3 className="font-heading text-lg text-fg">{step.title}</h3>
          {step.body && <p className="prose-measure mt-1.5 text-sm">{step.body}</p>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Many things feeding one thing.
 *
 * For the partner network and the live-data sections, where the shape of the
 * claim is "these arrive here" and a list would lose the arriving.
 */
export function ConvergeDiagram({
  sources,
  target,
  outcome,
}: {
  sources: string[];
  target: string;
  outcome?: string;
}) {
  return (
    <div className="rounded-[var(--r-lg)] border border-overlay/10 bg-card p-6 sm:p-8">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {sources.map((source, index) => (
          <div
            key={source}
            className="nx-rise rounded-[var(--r-sm)] border border-overlay/10 px-3 py-2.5 text-center text-xs text-muted"
            style={{ '--nx-delay': `${index * 70}ms` } as CSSProperties}
          >
            {source}
          </div>
        ))}
      </div>

      <div className="my-5 flex justify-center" aria-hidden>
        <span className="text-faint">↓</span>
      </div>

      <div
        className="mx-auto max-w-xs rounded-[var(--r-md)] px-5 py-4 text-center font-heading text-lg text-fg"
        style={{
          border: '1px solid var(--gold)',
          background: 'color-mix(in srgb, var(--gold) 6%, transparent)',
        }}
      >
        {target}
      </div>

      {outcome && (
        <>
          <div className="my-5 flex justify-center" aria-hidden>
            <span className="text-faint">↓</span>
          </div>
          <p className="text-center text-sm text-muted">{outcome}</p>
        </>
      )}
    </div>
  );
}

/**
 * The growth direction.
 *
 * Drawn as widening bands rather than a timeline with dates, because the brief
 * is explicit that this is a direction and not a schedule — and a row of dates
 * is a promise whatever the caption says.
 */
export function GrowthLadder({ stages }: { stages: { label: string; today?: boolean }[] }) {
  return (
    <div className="space-y-2.5">
      {stages.map((stage, index) => (
        <div
          key={stage.label}
          className="nx-bar flex items-center justify-between rounded-[var(--r-sm)] px-4 py-3.5"
          style={
            {
              '--nx-delay': `${index * 110}ms`,
              width: `${58 + index * 7}%`,
              minWidth: '16rem',
              maxWidth: '100%',
              border: stage.today
                ? '1px solid var(--gold)'
                : '1px solid rgb(var(--c-overlay) / 0.1)',
              background: stage.today
                ? 'color-mix(in srgb, var(--gold) 7%, transparent)'
                : 'rgb(var(--c-overlay) / 0.02)',
            } as CSSProperties
          }
        >
          <span className={stage.today ? 'text-sm font-semibold text-fg' : 'text-sm text-muted'}>
            {stage.label}
          </span>
          {stage.today && (
            <span
              className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--gold)' }}
            >
              Bugün
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
