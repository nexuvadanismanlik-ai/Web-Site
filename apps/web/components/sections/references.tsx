import type { CSSProperties } from 'react';
import type { ReferenceItem, SectionMeta } from '@nexuva/types';
import { t, type Locale } from '../../lib/i18n';
import { SectionHeading } from './section-heading';

function ReferenceCard({
  item,
  locale,
}: {
  item: ReferenceItem & { __idx: number };
  locale: Locale;
}) {
  const initials = item.name
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="group flex w-72 shrink-0 items-center gap-4 rounded-2xl border border-overlay/10 bg-card px-5 py-4 shadow-card transition-all duration-300 hover:border-overlay/25">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-overlay/10 bg-overlay/5 font-heading text-base font-bold text-fg transition-all duration-500 group-hover:text-white group-hover:brand-gradient-bg">
        {initials}
      </div>
      <div className="min-w-0">
        <div
          className="truncate font-heading text-base font-semibold text-fg"
          data-edit={`references.${item.__idx}.name`}
        >
          {item.name}
        </div>
        <div
          className="truncate text-xs uppercase tracking-wide text-faint"
          data-edit={`references.${item.__idx}.category`}
        >
          {t(item.category, locale)}
        </div>
      </div>
    </div>
  );
}

function Row({
  items,
  locale,
  reverse = false,
  duration = '46s',
}: {
  items: (ReferenceItem & { __idx: number })[];
  locale: Locale;
  reverse?: boolean;
  duration?: string;
}) {
  const doubled = [...items, ...items];
  return (
    <div className="marquee-mask pause-on-hover overflow-hidden py-2">
      <div
        className={`marquee-track ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'}`}
        style={{ '--marquee-duration': duration } as CSSProperties}
      >
        {doubled.map((item, i) => (
          <ReferenceCard key={`${item.id}-${i}`} item={item} locale={locale} />
        ))}
      </div>
    </div>
  );
}

export function References({
  meta,
  references,
  locale,
  hideHeading = false,
}: {
  meta: SectionMeta;
  references: ReferenceItem[];
  locale: Locale;
  hideHeading?: boolean;
}) {
  if (references.length === 0) return null;

  const indexed = references.map((r, i) => ({ ...r, __idx: i }));
  const mid = Math.ceil(indexed.length / 2);
  const rowA = indexed.slice(0, mid);
  const rowB = indexed.slice(mid);
  return (
    <section id="references" className={`overflow-hidden ${hideHeading ? 'py-8' : 'section'}`}>
      {!hideHeading && (
        <div className="container-x">
          <SectionHeading meta={meta} locale={locale} basePath="referencesMeta" />
        </div>
      )}
      <div className={`flex flex-col gap-4 ${hideHeading ? '' : 'mt-14'}`}>
        <Row items={rowA.length ? rowA : indexed} locale={locale} duration="44s" />
        <Row items={rowB.length ? rowB : indexed} locale={locale} reverse duration="52s" />
      </div>
    </section>
  );
}
