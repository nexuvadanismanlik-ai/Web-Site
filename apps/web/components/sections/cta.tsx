import Link from 'next/link';
import type { CtaContent } from '@nexuva/types';
import { t } from '../../lib/i18n';
import { Icon } from '../icon';
import { Reveal } from '../motion';

export function Cta({ cta }: { cta: CtaContent }) {
  return (
    <section className="section">
      <div className="container-x">
        <Reveal>
          <div className="cta-band relative overflow-hidden rounded-[var(--r-xl)] px-6 py-16 sm:px-16 sm:py-20">
            {/* One decorative layer, and it is the brand's own colour rather
                than a stock glow: a gold hairline across the top edge. */}
            <div className="rule-gold absolute inset-x-16 top-0" aria-hidden />
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
              style={{
                background:
                  'radial-gradient(closest-side, color-mix(in srgb, var(--brand) 40%, transparent), transparent)',
              }}
              aria-hidden
            />

            <h2 className="display-2 max-w-2xl text-white" data-edit="cta.title">
              {t(cta.title)}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg" data-edit="cta.subtitle">
              {t(cta.subtitle)}
            </p>
            <div className="mt-9 flex">
              <Link
                href={cta.button.href}
                data-cta="band"
                data-edit="cta.button.label"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-ink-950 shadow-[var(--shadow-float)] transition-transform duration-[--t-fast] hover:-translate-y-0.5"
              >
                {t(cta.button.label)}
                <Icon
                  name="arrow-right"
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
