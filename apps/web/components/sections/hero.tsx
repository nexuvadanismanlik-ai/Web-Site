'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { HeroContent } from '@nexuva/types';
import { t } from '../../lib/i18n';
import { PHOTOS, photoSrcSet, photoUrl } from '../../lib/imagery';
import { Magnetic } from '../motion';

/**
 * The first screen: one full-bleed photograph with the headline over it.
 *
 * The photograph is the panel's background image when one is uploaded, and
 * the Istanbul night photo otherwise. Headline, subtitle and buttons come from
 * the panel. The metric row is not shown: its figures are not verified.
 */
export function Hero({ hero }: { hero: HeroContent }) {
  // All load motion here is CSS (hero-settle, hero-rise in globals.css), so the
  // server and the browser render the same markup whatever the visitor's
  // reduced-motion setting, and the motion is switched off in CSS for them.

  // There is always something to look at now: an uploaded picture when the
  // panel has one, and an interface illustration otherwise. The section used
  // to fall back to a centred column of text over two coloured blurs, which is
  // what a page looks like when it has nothing to show — and every reader can
  // tell.

  const bg = hero.backgroundImage || photoUrl(PHOTOS.istanbul, 2400);
  const srcSet = hero.backgroundImage ? undefined : photoSrcSet(PHOTOS.istanbul);

  return (
    <section
      data-dark-hero
      className="on-photo relative isolate flex min-h-[100svh] items-end overflow-hidden bg-[#0d1420] pb-16 pt-36 text-white sm:pb-24"
    >
      {/* One full-bleed photograph, settling into place on load. That slow
          settle is the page's single orchestrated moment. */}
      <img
        src={bg}
        srcSet={srcSet}
        sizes="100vw"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        className="hero-settle absolute inset-0 -z-20 h-full w-full object-cover"
      />
      {/* Darker towards the words, so they read over any photograph. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(8,12,20,0.88)_0%,rgba(8,12,20,0.62)_45%,rgba(8,12,20,0.18)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[rgba(8,12,20,0.7)] to-transparent"
      />

      <div className="container-x w-full">
        <div className="max-w-3xl">
          <div className="hero-rise" style={{ animationDelay: '0.3s' }}>
            <span className="hero-kicker" data-edit="hero.badge">
              {t(hero.badge)}
            </span>
          </div>

          <h1 className="hero-rise display-1 mt-6 text-white" style={{ animationDelay: '0.42s' }}>
            <span data-edit="hero.titleLead">{t(hero.titleLead)}</span>{' '}
            <span
              className="italic"
              style={{ color: 'var(--gold)' }}
              data-edit="hero.titleHighlight"
            >
              {t(hero.titleHighlight)}
            </span>
          </h1>

          <p
            style={{ animationDelay: '0.56s' }}
            className="hero-rise mt-7 max-w-[56ch] text-lg leading-relaxed text-white/80 sm:text-xl"
            data-edit="hero.subtitle"
          >
            {t(hero.subtitle)}
          </p>

          <div
            style={{ animationDelay: '0.7s' }}
            className="hero-rise mt-10 flex flex-col gap-3 sm:flex-row"
          >
            <Magnetic>
              <Link
                href={hero.primaryCta.href}
                className="btn-primary group"
                data-cta="hero-primary"
                data-edit="hero.primaryCta.label"
              >
                {t(hero.primaryCta.label)}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </Magnetic>
            <Link
              href={hero.secondaryCta.href}
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/35 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-white/10"
              data-cta="hero-secondary"
              data-edit="hero.secondaryCta.label"
            >
              {t(hero.secondaryCta.label)}
              <ArrowUpRight className="h-4 w-4 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
