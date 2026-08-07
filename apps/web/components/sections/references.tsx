import type { CSSProperties } from 'react';
import type { ReferenceItem, SectionMeta } from '@nexuva/types';
import { t } from '../../lib/i18n';
import { SectionHeading } from './section-heading';
import { ReferenceCorridor } from './reference-corridor';

type Indexed = ReferenceItem & { __idx: number };

/** The brand's own mark, or its initials until a logo is uploaded. */
function Mark({ item }: { item: ReferenceItem }) {
  if (item.logoUrl) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-overlay/10 bg-white">
        <img src={item.logoUrl} alt={item.name} loading="lazy" className="h-full w-full object-contain p-1.5" />
      </span>
    );
  }

  const initials = item.name
    .split(' ')
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-overlay/10 bg-overlay/5 font-heading text-sm font-bold text-fg transition-all duration-500 group-hover:brand-gradient-bg group-hover:text-white">
      {initials}
    </span>
  );
}

/** The compact form, for brands carrying only a name and a sector. */
function StripCard({ item }: { item: Indexed }) {
  return (
    <div className="group flex w-72 shrink-0 items-center gap-4 rounded-2xl border border-overlay/10 bg-card px-5 py-4 shadow-card transition-all duration-300 hover:border-overlay/25">
      <Mark item={item} />
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
          {t(item.category)}
        </div>
      </div>
    </div>
  );
}

function Row({
  items,
  reverse = false,
  duration = '46s',
}: {
  items: Indexed[];
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
          <StripCard key={`${item.id}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

/**
 * References, in whichever form the content has earned.
 *
 * A studio that wants its client list read sets the names large in a column of
 * rules and shows a picture when the reader's attention is already on that
 * line. So every reference now goes through the corridor — the grid of
 * identical cards is what a directory looks like, and it made six real clients
 * read as filler.
 *
 * The moving strip stays for the case where there is nothing but names and no
 * pictures at all: a corridor of bare rows is a list, and a list is better
 * shown moving than pretending to be editorial.
 */
export function References({
  meta,
  references,
  hideHeading = false,
}: {
  meta: SectionMeta;
  references: ReferenceItem[];
  hideHeading?: boolean;
}) {
  if (references.length === 0) return null;

  const indexed: Indexed[] = references.map((r, i) => ({ ...r, __idx: i }));

  // Nothing but names and no pictures anywhere: the corridor has nothing to
  // reveal, so the strip is the honest presentation.
  const hasAnyVisual = references.some((item) => item.imageUrl || item.logoUrl);

  if (!hasAnyVisual) {
    const mid = Math.ceil(indexed.length / 2);
    const rowA = indexed.slice(0, mid);
    const rowB = indexed.slice(mid);

    return (
      <section id="references" className={`overflow-hidden ${hideHeading ? 'py-8' : 'section'}`}>
        {!hideHeading && (
          <div className="container-x">
            <SectionHeading meta={meta} basePath="referencesMeta" />
          </div>
        )}
        <div className={`flex flex-col gap-4 ${hideHeading ? '' : 'mt-14'}`}>
          <Row items={rowA} duration="44s" />
          {rowB.length > 0 && <Row items={rowB} reverse duration="52s" />}
        </div>
      </section>
    );
  }

  return (
    <section id="references" className={hideHeading ? 'py-8' : 'section'}>
      <div className="container-x">
        {!hideHeading && <SectionHeading meta={meta} basePath="referencesMeta" />}
        <div className={hideHeading ? '' : 'mt-12'}>
          <ReferenceCorridor items={references} />
        </div>
      </div>
    </section>
  );
}
