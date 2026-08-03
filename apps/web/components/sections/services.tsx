import Link from 'next/link';
import type { ServiceItem, SectionMeta } from '@nexuva/types';
import { t, type Locale } from '../../lib/i18n';
import { Icon } from '../icon';
import { SectionHeading } from './section-heading';
import { Reveal, Stagger, StaggerItem } from '../motion';

export function Services({
  meta,
  services,
  locale,
  showAll = false,
  hideHeading = false,
}: {
  meta: SectionMeta;
  services: ServiceItem[];
  locale: Locale;
  showAll?: boolean;
  hideHeading?: boolean;
}) {
  const list = showAll ? services : services.slice(0, 6);
  return (
    <section id="services" className={hideHeading ? 'py-8' : 'section'}>
      <div className="container-x">
        {!hideHeading && <SectionHeading meta={meta} locale={locale} basePath="servicesMeta" />}

        <Stagger
          className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${hideHeading ? '' : 'mt-16'}`}
          gap={0.08}
        >
          {list.map((svc, i) => (
            <StaggerItem key={svc.id}>
              <div className="card-surface group h-full p-7">
                <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-overlay/10 bg-overlay/5">
                  <div className="absolute inset-0 rounded-2xl brand-gradient-bg opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <Icon
                    name={svc.icon}
                    className="relative h-6 w-6 text-brand-dyn transition-colors duration-500 group-hover:text-white"
                  />
                </div>
                <h3 className="font-heading text-xl font-semibold text-fg" data-edit={`services.${i}.title`}>
                  {t(svc.title, locale)}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted" data-edit={`services.${i}.description`}>
                  {t(svc.description, locale)}
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
                      {t(f, locale)}
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {!showAll && (
          <Reveal className="mt-12 text-center" delay={0.1}>
            <Link href={`/${locale}/services`} className="btn-ghost">
              {locale === 'tr' ? 'Tüm hizmetleri gör' : 'View all services'}
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </Reveal>
        )}
      </div>
    </section>
  );
}
