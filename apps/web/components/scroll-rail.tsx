'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { type RefObject } from 'react';

/**
 * A hairline that fills as its section scrolls past.
 *
 * The idea is Aceternity's scroll-beam timeline (21st.dev #857): a track behind
 * the content, and a coloured beam whose length is tied to how far through the
 * section the reader is. It turns a static list into something that responds to
 * the one input every visitor is already giving you.
 *
 * Three things are done differently here, and each is a fault in the original
 * rather than a matter of taste:
 *
 *  1. The original measures the track with `getBoundingClientRect()` in a
 *     `useEffect` and animates `height` in pixels. That measurement is taken
 *     once — after a resize, a font swap or any content reflow the beam is the
 *     wrong length, and on a site that has to work at 320px that is most of the
 *     time. Here the beam is a `scaleY` from 0 to 1, so there is nothing to
 *     measure: it is correct at every width by construction, and it animates on
 *     the compositor instead of triggering layout on every scroll frame.
 *
 *  2. Because scaling would stretch a gradient along the beam, the softening
 *     lives on the track as a mask instead. The beam itself is a solid rule, so
 *     it looks the same at 5% and at 95%.
 *
 *  3. Reduced motion. Scroll-linked movement is not the same hazard as motion
 *     that starts on its own, but a rule that grows while you read is still
 *     movement — so for a visitor who has asked for less, the beam is simply
 *     drawn complete and the travelling dot is dropped. The section keeps its
 *     rule; it just does not perform.
 */
export function ScrollRail({
  target,
  orientation = 'vertical',
  className,
}: {
  /** The element whose scroll progress drives the fill. */
  target: RefObject<HTMLElement | null>;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}) {
  const reduced = useReducedMotion();
  const vertical = orientation === 'vertical';

  // Starts when the section's top reaches four-fifths of the way down the
  // viewport and completes when its end reaches the middle — so the rail is
  // full at the moment the last step is comfortably readable, not once the
  // section has already left.
  const { scrollYProgress } = useScroll({
    target,
    offset: ['start 80%', 'end 55%'],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const lead = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const dotOpacity = useTransform(scrollYProgress, [0, 0.04, 0.96, 1], [0, 1, 1, 0]);

  const track = vertical ? 'w-px' : 'h-px';
  const mask = vertical
    ? 'linear-gradient(to bottom, transparent, black 6%, black 94%, transparent)'
    : 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)';

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${track} ${className ?? ''}`}
      style={{
        background: 'rgb(var(--c-overlay) / 0.12)',
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'var(--gold)',
          transformOrigin: vertical ? 'top' : 'left',
          ...(reduced
            ? { transform: 'none' }
            : vertical
              ? { scaleY: scale }
              : { scaleX: scale }),
        }}
      />
      {/* The leading edge. A single lit point is what makes the rail read as
          being drawn rather than as a bar that happens to be a certain length. */}
      {!reduced && (
        <motion.span
          className="absolute h-1.5 w-1.5 rounded-full"
          style={{
            background: 'var(--gold)',
            boxShadow: '0 0 0 3px color-mix(in srgb, var(--gold) 22%, transparent)',
            opacity: dotOpacity,
            ...(vertical
              ? { top: lead, left: '50%', x: '-50%', y: '-50%' }
              : { left: lead, top: '50%', x: '-50%', y: '-50%' }),
          }}
        />
      )}
    </div>
  );
}
