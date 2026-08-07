import type { CSSProperties } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { ReferenceItem, SectionMeta } from '@nexuva/types';
import { t } from '../../lib/i18n';
import { SectionHeading } from './section-heading';
import { Stagger, StaggerItem } from '../motion';

type Indexed = ReferenceItem & { __idx: number };

/** Has this reference been given enough to be worth reading rather than counting? */
function isDetailed(item: ReferenceItem): boolean {
  return Boolean(item.description?.tr?.trim() || item.imageUrl);
}

/**
 * A reference with something to say.
 *
 * Logo, sector, what was done, and a link the reader can follow to check it.
 * The link matters more than it looks: a claim nobody can verify is decoration,
 * and a claim anyone can verify is evidence.
 */
function DetailCard({ item }: { item: Indexed }) {
  return (
    <article className="card-surface group flex h-full flex-col overflow-hidden">
      {item.imageUrl && (
        <div className="aspect-[16/10] overflow-hidden border-b border-overlay/10 bg-overlay/5">
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3">
          <Mark item={item} />
          <div className="min-w-0">
            <h3
              className="truncate font-heading text-base font-semibold text-fg"
              data-edit={`references.${item.__idx}.name`}
            >
              {item.name}
            </h3>
            <p
              className="truncate text-xs uppercase tracking-wide text-faint"
              data-edit={`references.${item.__idx}.category`}
            >
              {t(item.category)}
            </p>
          </div>
        </div>

        {item.description?.tr && (
          <p
            className="mt-4 flex-1 text-sm leading-relaxed text-muted"
            data-edit={`references.${item.__idx}.description`}
          >
            {t(item.description)}
          </p>
        )}

        {item.website && (
          <a
            href={item.website}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-brand-dyn transition-opacity hover:opacity-75"
          >
            Siteyi ziyaret et
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </article>
  );
}

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
 * Ones with a story get a card that tells it; ones that are only a name keep
 * the moving strip. Both at once, because filling in the detail for eleven
 * clients before any of them can be shown properly is how a section stays empty
 * for a year.
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
  const detailed = indexed.filter(isDetailed);
  const plain = indexed.filter((item) => !isDetailed(item));

  const mid = Math.ceil(plain.length / 2);
  const rowA = plain.slice(0, mid);
  const rowB = plain.slice(mid);

  return (
    <section id="references" className={`overflow-hidden ${hideHeading ? 'py-8' : 'section'}`}>
      {!hideHeading && (
        <div className="container-x">
          <SectionHeading meta={meta} basePath="referencesMeta" />
        </div>
      )}

      {detailed.length > 0 && (
        <div className="container-x">
          <Stagger
            className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${hideHeading ? '' : 'mt-14'}`}
            gap={0.08}
          >
            {detailed.map((item) => (
              <StaggerItem key={item.id}>
                <DetailCard item={item} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      )}

      {plain.length > 0 && (
        <div
          className={`flex flex-col gap-4 ${
            detailed.length > 0 ? 'mt-14' : hideHeading ? '' : 'mt-14'
          }`}
        >
          <Row items={rowA.length ? rowA : plain} duration="44s" />
          {rowB.length > 0 && <Row items={rowB} reverse duration="52s" />}
        </div>
      )}
    </section>
  );
}
