import type { StatItem } from '@nexuva/types';
import { t, type Locale } from '../../lib/i18n';
import { CountUp, StaggerItem, Stagger } from '../motion';

export function Stats({ stats, locale }: { stats: StatItem[]; locale: Locale }) {
  return (
    <section className="relative py-8">
      <div className="container-x">
        <div className="relative overflow-hidden rounded-4xl border border-overlay/10 bg-card/80 px-6 py-12 shadow-card sm:px-12">
          <div className="pointer-events-none absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand)_12%,transparent),transparent)]" />
          <div className="pointer-events-none absolute -right-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_12%,transparent),transparent)]" />
          <Stagger className="relative grid grid-cols-2 gap-8 lg:grid-cols-4" gap={0.1}>
            {stats.map((s, i) => (
              <StaggerItem key={s.id} className="text-center">
                <div className="font-heading text-4xl font-bold gradient-text sm:text-5xl">
                  <span data-edit={`stats.${i}.value`}>
                    <CountUp to={s.value} prefix={s.prefix ?? ''} suffix={s.suffix} />
                  </span>
                </div>
                <div className="mt-2 text-sm font-medium text-muted" data-edit={`stats.${i}.label`}>{t(s.label, locale)}</div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
