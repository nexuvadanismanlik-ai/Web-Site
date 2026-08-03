'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, Play, Sparkles } from 'lucide-react';
import type { HeroContent } from '@nexuva/types';
import { t, type Locale } from '../../lib/i18n';

const EASE = [0.16, 1, 0.3, 1] as const;

function localized(href: string, locale: Locale) {
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
}

export function Hero({ hero, locale }: { hero: HeroContent; locale: Locale }) {
  return (
    <section className="relative overflow-hidden pt-36 pb-20 sm:pt-44 sm:pb-28">
      {/* Decorative animated blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand)_14%,transparent),transparent)]" />
        <div className="absolute right-[6%] top-40 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_12%,transparent),transparent)]" />
        <div className="absolute inset-0 bg-grid-slate bg-[size:56px_56px] opacity-25 [mask-image:radial-gradient(60%_50%_at_50%_30%,black,transparent)]" />
      </div>

      <div className="container-x">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <span className="eyebrow" data-edit="hero.badge">
              <Sparkles className="h-3.5 w-3.5 text-brand-dyn" />
              {t(hero.badge, locale)}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
            className="mt-7 font-heading text-4xl font-bold leading-[1.08] text-fg text-balance sm:text-6xl md:text-7xl"
          >
            <span data-edit="hero.titleLead">{t(hero.titleLead, locale)}</span>{' '}
            <span className="gradient-text" data-edit="hero.titleHighlight">{t(hero.titleHighlight, locale)}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
            className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted"
            data-edit="hero.subtitle"
          >
            {t(hero.subtitle, locale)}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.24 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href={localized(hero.primaryCta.href, locale)}
              className="btn-primary group"
              data-edit="hero.primaryCta.label"
            >
              {t(hero.primaryCta.label, locale)}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href={localized(hero.secondaryCta.href, locale)}
              className="btn-ghost group"
              data-edit="hero.secondaryCta.label"
            >
              <Play className="h-4 w-4 fill-current" />
              {t(hero.secondaryCta.label, locale)}
            </Link>
          </motion.div>

          {/* Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.34 }}
            className="mx-auto mt-16 grid max-w-2xl grid-cols-3 divide-x divide-overlay/10 rounded-3xl border border-overlay/10 bg-card/80 py-7 shadow-card"
          >
            {hero.metrics.map((m, i) => (
              <div key={i} className="px-3 text-center">
                <div
                  className="font-heading text-2xl font-bold text-fg sm:text-3xl"
                  data-edit={`hero.metrics.${i}.value`}
                >
                  {m.value}
                </div>
                <div
                  className="mt-1 text-xs text-muted sm:text-sm"
                  data-edit={`hero.metrics.${i}.label`}
                >
                  {t(m.label, locale)}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
