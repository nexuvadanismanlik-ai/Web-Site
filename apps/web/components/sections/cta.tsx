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
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 px-6 py-16 text-center sm:px-16 sm:py-20">
            {/* Glow background */}
            <div className="pointer-events-none absolute inset-0 -z-10 brand-gradient-bg opacity-90" />
            <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate bg-[size:44px_44px] opacity-20" />
            <div className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.25),transparent)]" />

            <h2
              className="mx-auto max-w-2xl font-heading text-3xl font-bold text-white text-balance sm:text-4xl md:text-5xl"
              data-edit="cta.title"
            >
              {t(cta.title)}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-white/80 sm:text-lg" data-edit="cta.subtitle">
              {t(cta.subtitle)}
            </p>
            <div className="mt-9 flex justify-center">
              <Link
                href={cta.button.href}
                data-cta="band"
                data-edit="cta.button.label"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-ink-950 shadow-2xl transition-transform duration-300 hover:-translate-y-0.5 hover:scale-[1.02]"
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
