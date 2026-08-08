'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Four disciplines arriving at one team.
 *
 * This draws a sentence the About section already makes — "strateji, tasarım,
 * mühendislik ve büyüme disiplinlerini tek ekipte birleştiriyoruz" — rather
 * than asserting anything new. That distinction is the whole reason it is a
 * diagram and not a photograph: a stock picture of people at laptops would be
 * a claim about a team nobody has photographed, and every reader knows it.
 *
 * It stands in the slot a real picture of the team will take. The moment one is
 * uploaded in the panel this disappears — same arrangement as the hero, where
 * the illustration yields to an uploaded image without any code changing.
 *
 * Lines draw when the section is reached, not on page load: this sits well
 * below the fold, and an animation that has already finished by the time
 * anybody sees it is cost with no effect.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const DISCIPLINES = [
  { label: 'Strateji', y: 34 },
  { label: 'Tasarım', y: 88 },
  { label: 'Mühendislik', y: 142 },
  { label: 'Büyüme', y: 196 },
] as const;

/** The join point every line curves towards. */
const HUB = { x: 296, y: 115, r: 40 };

export function DisciplineVisual() {
  const reduced = useReducedMotion();

  // Reduced motion gets the finished drawing, immediately — the same picture,
  // already complete, rather than a lesser version of it.
  const draw = (delay: number) =>
    reduced
      ? { initial: { pathLength: 1, opacity: 0.9 }, animate: { pathLength: 1, opacity: 0.9 } }
      : {
          initial: { pathLength: 0, opacity: 0 },
          whileInView: { pathLength: 1, opacity: 0.9 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.9, ease: EASE, delay },
        };

  return (
    <figure className="rounded-[var(--r-lg)] border border-overlay/10 bg-card p-5 sm:p-7">
      <svg
        viewBox="0 0 400 230"
        role="img"
        aria-label="Strateji, tasarım, mühendislik ve büyüme disiplinleri tek ekipte birleşiyor"
        className="h-auto w-full"
      >
        {DISCIPLINES.map((item, index) => (
          <g key={item.label}>
            <text
              x="118"
              y={item.y + 4}
              textAnchor="end"
              style={{
                fill: 'rgb(var(--c-muted))',
                fontSize: 13,
                fontFamily: 'var(--font-sans, inherit)',
              }}
            >
              {item.label}
            </text>
            {/* A curve rather than a straight line: four straight lines to a
                point is a starburst, which reads as an explosion outwards. The
                bend makes the direction of travel inwards. */}
            <motion.path
              d={`M 128 ${item.y} C 200 ${item.y}, 210 ${HUB.y}, ${HUB.x - HUB.r - 6} ${HUB.y}`}
              fill="none"
              stroke="var(--gold)"
              strokeWidth={1}
              strokeLinecap="round"
              {...draw(0.1 + index * 0.12)}
            />
          </g>
        ))}

        <motion.circle
          cx={HUB.x}
          cy={HUB.y}
          r={HUB.r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={1}
          initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: EASE, delay: reduced ? 0 : 0.75 }}
          style={{ transformOrigin: `${HUB.x}px ${HUB.y}px` }}
        />
        <motion.text
          x={HUB.x}
          y={HUB.y + 5}
          textAnchor="middle"
          style={{ fill: 'rgb(var(--c-fg))', fontSize: 14, fontFamily: 'var(--font-heading, inherit)' }}
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: reduced ? 0 : 0.95 }}
        >
          Tek ekip
        </motion.text>
      </svg>
      <figcaption className="mt-1 text-center text-xs text-faint">
        Dört disiplin, tek sorumluluk. Aradaki devir teslimler kayıp üretir.
      </figcaption>
    </figure>
  );
}
