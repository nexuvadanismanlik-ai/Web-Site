'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import type { HeroContent } from '@nexuva/types';
import { t } from '../../lib/i18n';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The first screen.
 *
 * Two layouts, chosen by whether there is an image to show. With one, the
 * headline and the composition sit side by side and the section has something
 * to look at; without one it stays centred, because a two-column layout with an
 * empty column is worse than no column at all.
 *
 * The image is framed rather than dropped in flat — a border, a soft shadow and
 * a highlight behind it — so that a plain screenshot reads as a product rather
 * than as a stock photo pasted onto a gradient.
 *
 * Everything here comes from the panel, including both images. Nothing on this
 * screen is written in this file.
 */
export function Hero({ hero }: { hero: HeroContent }) {
  // The hero animates on load, so it is the first thing a reduced-motion
  // visitor would be shown moving. Collapsed to zero rather than removed, which
  // keeps one code path.
  const rise = useReducedMotion() ? 0 : 1;
  const hasImage = Boolean(hero.image);

  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 22 * rise },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE, delay },
  });

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Backdrop. A chosen photograph when there is one, and the house
          gradient otherwise — never both, or the section becomes soup. */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {hero.backgroundImage ? (
          <>
            {/* Deliberately not next/image: static export with unoptimized
                images, and this is a full-bleed backdrop rather than content. */}
            <img
              src={hero.backgroundImage}
              alt=""
              className="h-full w-full object-cover"
              aria-hidden="true"
            />
            {/* Text has to stay readable over whatever was uploaded. */}
            <div className="absolute inset-0 bg-[var(--c-bg)]/88" />
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--c-bg)] via-transparent to-[var(--c-bg)]" />
          </>
        ) : (
          <>
            <div className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand)_14%,transparent),transparent)]" />
            <div className="absolute right-[6%] top-40 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_12%,transparent),transparent)]" />
            <div className="absolute inset-0 bg-grid-slate bg-[size:56px_56px] opacity-25 [mask-image:radial-gradient(60%_50%_at_50%_30%,black,transparent)]" />
          </>
        )}
      </div>

      <div className="container-x">
        <div
          className={
            hasImage
              ? 'grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16'
              : 'mx-auto max-w-4xl text-center'
          }
        >
          {/* ── Words ──────────────────────────────────────────────────── */}
          <div className={hasImage ? 'text-left' : ''}>
            <motion.div {...enter(0)}>
              <span className="eyebrow" data-edit="hero.badge">
                <Sparkles className="h-3.5 w-3.5 text-brand-dyn" />
                {t(hero.badge)}
              </span>
            </motion.div>

            <motion.h1
              {...enter(0.08)}
              className={`mt-6 font-heading font-bold leading-[1.06] text-fg text-balance ${
                hasImage ? 'text-4xl sm:text-5xl xl:text-6xl' : 'text-4xl sm:text-6xl md:text-7xl'
              }`}
            >
              <span data-edit="hero.titleLead">{t(hero.titleLead)}</span>{' '}
              <span className="gradient-text" data-edit="hero.titleHighlight">
                {t(hero.titleHighlight)}
              </span>
            </motion.h1>

            <motion.p
              {...enter(0.16)}
              className={`mt-6 text-lg leading-relaxed text-muted ${
                hasImage ? 'max-w-xl' : 'mx-auto max-w-2xl'
              }`}
              data-edit="hero.subtitle"
            >
              {t(hero.subtitle)}
            </motion.p>

            <motion.div
              {...enter(0.24)}
              className={`mt-9 flex flex-col gap-3 sm:flex-row ${
                hasImage ? '' : 'items-center justify-center'
              }`}
            >
              <Link
                href={hero.primaryCta.href}
                className="btn-primary group"
                data-cta="hero-primary"
                data-edit="hero.primaryCta.label"
              >
                {t(hero.primaryCta.label)}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href={hero.secondaryCta.href}
                className="btn-ghost group"
                data-cta="hero-secondary"
                data-edit="hero.secondaryCta.label"
              >
                {t(hero.secondaryCta.label)}
                <ArrowUpRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </motion.div>

            {/* Metrics sit on the line rather than in a boxed panel: a panel
                announces itself, and these are supposed to be read in passing.
                Hidden entirely when there are none — a half-filled row of
                figures looks broken as well as unearned. */}
            {hero.metrics.length > 0 && (
              <motion.dl
                {...enter(0.34)}
                className={`mt-12 flex flex-wrap gap-x-10 gap-y-6 ${
                  hasImage ? '' : 'justify-center'
                }`}
              >
                {hero.metrics.map((m, i) => (
                  <div key={i}>
                    <dt
                      className="font-heading text-3xl font-bold text-fg"
                      data-edit={`hero.metrics.${i}.value`}
                    >
                      {m.value}
                    </dt>
                    <dd
                      className="mt-1 text-sm text-muted"
                      data-edit={`hero.metrics.${i}.label`}
                    >
                      {t(m.label)}
                    </dd>
                  </div>
                ))}
              </motion.dl>
            )}
          </div>

          {/* ── Composition ────────────────────────────────────────────── */}
          {hasImage && (
            <motion.div
              initial={{ opacity: 0, y: 34 * rise, scale: 1 - 0.02 * rise }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
              className="relative"
            >
              {/* A glow behind the frame gives the image somewhere to sit;
                  without it a screenshot floats on the background. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand)_22%,transparent),transparent)] blur-2xl"
              />
              <div className="overflow-hidden rounded-2xl border border-overlay/15 bg-card shadow-2xl ring-1 ring-black/5">
                <img
                  src={hero.image}
                  alt={hero.imageAlt ?? ''}
                  className="block h-auto w-full"
                  loading="eager"
                  // Told to the browser so the layout does not jump while it
                  // loads. Overridden by the aspect the file actually has.
                  width={1200}
                  height={800}
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
