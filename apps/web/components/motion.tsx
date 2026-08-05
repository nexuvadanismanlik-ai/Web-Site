'use client';

import { motion, useInView, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The CSS in globals.css stops the marquees for someone who has asked for less
 * motion, but framer-motion animates from JavaScript and never sees that media
 * query — so every section still slid into view. For a person with vestibular
 * sensitivity that is the part that actually hurts.
 *
 * Content still appears; it just appears rather than travelling.
 */
function useMotionDistance(y: number): number {
  return useReducedMotion() ? 0 : y;
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
}

/** Fade + rise in as the element scrolls into view. */
export function Reveal({ children, className, delay = 0, y = 28, once = true }: RevealProps) {
  const distance = useMotionDistance(y);
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-80px' }}
      transition={{ duration: distance === 0 ? 0.2 : 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
  gap?: number;
}

/** Container whose direct <Stagger.Item> children reveal one after another. */
export function Stagger({ children, className, gap = 0.1 }: StaggerProps) {
  // A stagger is motion made of waiting. Reduced motion means no wait either.
  const step = useReducedMotion() ? 0 : gap;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: step } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 28,
  ...rest
}: { children: ReactNode; className?: string; y?: number } & HTMLMotionProps<'div'>) {
  const distance = useMotionDistance(y);
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: distance },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: distance === 0 ? 0.2 : 0.6, ease: EASE },
        },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Animated number that counts up when scrolled into view. */
export function CountUp({
  to,
  duration = 2,
  prefix = '',
  suffix = '',
  className,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    // A number spinning up from zero is motion too. Show the figure.
    if (reduced) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString('tr-TR')}
      {suffix}
    </span>
  );
}

/** Subtle parallax-y floating wrapper for decorative blobs. */
export function Float({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
