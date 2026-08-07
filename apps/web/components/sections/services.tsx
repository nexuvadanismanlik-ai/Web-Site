import Link from 'next/link';
import type { ServiceItem, SectionMeta } from '@nexuva/types';
import { t } from '../../lib/i18n';
import { Icon } from '../icon';
import { SectionHeading } from './section-heading';
import { Reveal, Stagger, StaggerItem } from '../motion';

export function Services({
  meta,
  services,
  showAll = false,
  hideHeading = false,
  allServicesLabel = 'Tüm hizmetleri gör',
}: {
  meta: SectionMeta;
  services: ServiceItem[];
  showAll?: boolean;
  hideHeading?: boolean;
  /** Panel-managed. The default keeps the link working before it is set. */
  allServicesLabel?: string;
}) {
  if (services.length === 0) return null;

  const list = showAll ? services : services.slice(0, 6);
  return (
    <section id="services" className={hideHeading ? 'py-8' : 'section'}>
      <div className="container-x">
        {!hideHeading && <SectionHeading meta={meta} basePath="servicesMeta" />}

        <Stagger
          className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${hideHeading ? '' : 'mt-16'}`}
          gap={0.08}
        >
          {list.map((svc, i) => (
            <StaggerItem key={svc.id}>
              <div className="service-card group flex h-full flex-col overflow-hidden">
                {/* An illustration when one has been chosen, the icon when not.
                    Both are complete cards; neither leaves a hole. */}
                {svc.imageUrl ? (
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-overlay/10 bg-overlay/5">
                    <img
                      src={svc.imageUrl}
                      alt={svc.imageAlt ?? ''}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col p-7">
                {!svc.imageUrl && (
                <div className="mb-6 flex items-center justify-between">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ border: '1px solid color-mix(in srgb, var(--gold) 45%, transparent)' }}
                  >
                    <Icon name={svc.icon} className="h-5 w-5 text-brand-dyn" />
                  </span>
                  {/* The index, set in the display face. Eight identical cards
                      become a numbered list, which is what a reader needs to
                      keep their place in one. */}
                  <span
                    aria-hidden
                    className="font-heading text-sm tabular-nums text-faint"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                )}
                <h3 className="font-heading text-xl text-fg" data-edit={`services.${i}.title`}>
                  {t(svc.title)}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted" data-edit={`services.${i}.description`}>
                  {t(svc.description)}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {svc.features.map((f, j) => (
                    <li
                      key={j}
                      className="flex items-center gap-2.5 text-sm text-muted"
                      data-edit={`services.${i}.features.${j}`}
                    >
                      <span
                        aria-hidden
                        className="h-px w-3 shrink-0"
                        style={{ background: 'var(--gold)' }}
                      />
                      {t(f)}
                    </li>
                  ))}
                </ul>

                {svc.cta?.label?.tr && (
                  <Link
                    href={svc.cta.href || '/contact'}
                    data-cta={`service-${svc.id}`}
                    className="mt-6 inline-flex items-center gap-1.5 self-start text-sm font-medium text-brand-dyn transition-opacity hover:opacity-75"
                  >
                    {t(svc.cta.label)}
                    <Icon name="arrow-right" className="h-3.5 w-3.5" />
                  </Link>
                )}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {!showAll && (
          <Reveal className="mt-12 text-center" delay={0.1}>
            <Link href={'/services'} className="btn-ghost">
              {allServicesLabel}
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </Reveal>
        )}
      </div>
    </section>
  );
}
