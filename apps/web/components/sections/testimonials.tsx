import type { CSSProperties } from 'react';
import type { TestimonialItem, SectionMeta } from '@nexuva/types';
import { t, type Locale } from '../../lib/i18n';
import { Icon } from '../icon';
import { SectionHeading } from './section-heading';

function TestimonialCard({
  item,
  locale,
  idx,
}: {
  item: TestimonialItem;
  locale: Locale;
  idx: number;
}) {
  const initials = item.author
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <figure className="flex w-[360px] shrink-0 flex-col justify-between rounded-3xl border border-overlay/10 bg-card shadow-card p-7">
      <div>
        <div className="flex gap-0.5">
          {Array.from({ length: item.rating }).map((_, i) => (
            <Icon key={i} name="star" className="h-4 w-4 fill-amber-400 text-amber-400" />
          ))}
        </div>
        <blockquote
          className="mt-4 text-[0.95rem] leading-relaxed text-fg/90"
          data-edit={`testimonials.${idx}.quote`}
        >
          “{t(item.quote, locale)}”
        </blockquote>
      </div>
      <figcaption className="mt-6 flex items-center gap-3.5 border-t border-overlay/10 pt-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full brand-gradient-bg font-heading text-sm font-bold text-white">
          {initials}
        </div>
        <div>
          <div
            className="font-heading text-sm font-semibold text-fg"
            data-edit={`testimonials.${idx}.author`}
          >
            {item.author}
          </div>
          <div className="text-xs text-muted">
            <span data-edit={`testimonials.${idx}.role`}>{t(item.role, locale)}</span> ·{' '}
            <span data-edit={`testimonials.${idx}.company`}>{item.company}</span>
          </div>
        </div>
      </figcaption>
    </figure>
  );
}

export function Testimonials({
  meta,
  testimonials,
  locale,
}: {
  meta: SectionMeta;
  testimonials: TestimonialItem[];
  locale: Locale;
}) {
  const doubled = [...testimonials, ...testimonials];
  return (
    <section className="section overflow-hidden">
      <div className="container-x">
        <SectionHeading meta={meta} locale={locale} basePath="testimonialsMeta" />
      </div>
      <div className="marquee-mask pause-on-hover mt-14 overflow-hidden">
        <div
          className="marquee-track animate-marquee items-stretch"
          style={{ '--marquee-duration': '55s' } as CSSProperties}
        >
          {doubled.map((item, i) => (
            <TestimonialCard
              key={`${item.id}-${i}`}
              item={item}
              locale={locale}
              idx={i % testimonials.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
