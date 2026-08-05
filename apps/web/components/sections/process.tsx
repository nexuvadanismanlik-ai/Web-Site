import type { ProcessStep, SectionMeta } from '@nexuva/types';
import { t, type Locale } from '../../lib/i18n';
import { SectionHeading } from './section-heading';
import { Stagger, StaggerItem } from '../motion';

export function Process({
  meta,
  steps,
  locale,
}: {
  meta: SectionMeta;
  steps: ProcessStep[];
  locale: Locale;
}) {
  if (steps.length === 0) return null;

  return (
    <section className="section">
      <div className="container-x">
        <SectionHeading meta={meta} locale={locale} basePath="processMeta" />

        <div className="relative mt-16">
          {/* Connecting line */}
          <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-overlay/15 to-transparent lg:block" />

          <Stagger className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4" gap={0.12}>
            {steps.map((step, i) => (
              <StaggerItem key={step.id} className="relative">
                <div className="relative z-10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-overlay/10 bg-card font-heading text-2xl font-bold shadow-card">
                  <span className="gradient-text">{String(i + 1).padStart(2, '0')}</span>
                  <span className="absolute inset-0 rounded-2xl border border-brand-500/30" />
                </div>
                <h3 className="font-heading text-lg font-semibold text-fg" data-edit={`process.${i}.title`}>
                  {t(step.title, locale)}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted" data-edit={`process.${i}.description`}>
                  {t(step.description, locale)}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
