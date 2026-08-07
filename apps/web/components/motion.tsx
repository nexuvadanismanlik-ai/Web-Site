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

/**
 * A headline that arrives a word at a time.
 *
 * Used once per page and only on the opening headline. A stagger is a way of
 * saying "read this first", and a page that says that about six things has
 * said it about none — which is what most sites using this effect have done.
 *
 * Words rather than characters. Character-by-character looks like a typewriter
 * and, in Turkish, breaks words at exactly the letters that carry the meaning.
 * It also produces one DOM node per letter, which for a headline is a few
 * hundred elements to animate for no gain.
 */
export function WordReveal({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const words = text.split(' ').filter(Boolean);

  if (reduced || words.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.055, delayChildren: delay } } }}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          // inline-block so the transform applies; the trailing space is a
          // separate text node so the words still wrap and select normally.
          className="inline-block"
          variants={{
            hidden: { opacity: 0, y: '0.4em' },
            visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
          }}
        >
          {word}
          {index < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </motion.span>
  );
}

/**
 * A button that leans towards the cursor.
 *
 * Small on purpose — six pixels of travel. The effect is meant to be felt
 * rather than noticed; a button that visibly chases the pointer is a toy, and
 * this sits on the page's main call to action.
 *
 * Ignored entirely on touch, where there is no cursor to lean towards, and
 * under reduced motion. The transform is written straight to the node rather
 * than held in state: this fires on every mouse move, and re-rendering a React
 * tree at that rate to move one element is the classic way to make a page feel
 * worse by adding polish to it.
 */
export function Magnetic({
  children,
  className,
  strength = 6,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced);
  }, [reduced]);

  if (!enabled) return <span className={className}>{children}</span>;

  const move = (event: React.MouseEvent<HTMLSpanElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    node.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  };

  const reset = () => {
    const node = ref.current;
    if (node) node.style.transform = 'translate(0, 0)';
  };

  return (
    <span
      ref={ref}
      onMouseMove={move}
      onMouseLeave={reset}
      className={className}
      style={{ display: 'inline-block', transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)' }}
    >
      {children}
    </span>
  );
}
