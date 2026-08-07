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
}: {
  meta: SectionMeta;
  services: ServiceItem[];
  showAll?: boolean;
  hideHeading?: boolean;
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
              <div className="card-surface group flex h-full flex-col overflow-hidden">
                {/* An illustration when one has been chosen, the icon when not.
                    Both are complete cards; neither leaves a hole. */}
                {svc.imageUrl ? (
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-overlay/10 bg-overlay/5">
                    <img
                      src={svc.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col p-7">
                {!svc.imageUrl && (
                <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-overlay/10 bg-overlay/5">
                  <div className="absolute inset-0 rounded-2xl brand-gradient-bg opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <Icon
                    name={svc.icon}
                    className="relative h-6 w-6 text-brand-dyn transition-colors duration-500 group-hover:text-white"
                  />
                </div>
                )}
                <h3 className="font-heading text-xl font-semibold text-fg" data-edit={`services.${i}.title`}>
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
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/15">
                        <Icon name="check" className="h-3 w-3 text-brand-dyn" />
                      </span>
                      {t(f)}
                    </li>
                  ))}
                </ul>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {!showAll && (
          <Reveal className="mt-12 text-center" delay={0.1}>
            <Link href={'/services'} className="btn-ghost">
              {'Tüm hizmetleri gör'}
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </Reveal>
        )}
      </div>
    </section>
  );
}
