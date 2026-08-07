'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { ReferenceItem } from '@nexuva/types';
import { t } from '../../lib/i18n';

/**
 * References as an editorial list rather than a grid of cards.
 *
 * Three columns of identical boxes is what a directory looks like. A studio
 * that wants its client list read puts it in a column of rules, sets the names
 * large, and shows the picture only when somebody's attention is already on
 * that line — which is what a cursor hovering it means.
 *
 * Adapted from a pattern on 21st.dev. The idea and the visual language are
 * theirs; the implementation is rewritten, because the original had three
 * faults that would have shown on this site:
 *
 *  - it drove the follow animation through React state, re-rendering the whole
 *    list sixty times a second while the mouse moved;
 *  - its animation frame loop listed the mouse position as a dependency, so
 *    every movement tore the loop down and started a new one;
 *  - it read `getBoundingClientRect()` during render, which is both a layout
 *    thrash and a stale value.
 *
 * Here the preview is moved by writing a transform straight onto the node from
 * inside the frame loop. React renders when the hovered row changes and at no
 * other time.
 *
 * On touch there is no cursor and therefore no hover, so the picture moves
 * inline into the row instead. That is a different layout, not a disabled one.
 */

const FOLLOW_OFFSET = { x: 24, y: -110 };

export function ReferenceCorridor({ items }: { items: ReferenceItem[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [pointerFine, setPointerFine] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  // Written by pointer events and read by the frame loop. Deliberately not
  // state: nothing on screen depends on the raw value, only on where the
  // preview ends up, and that is set on the node directly.
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  /**
   * Only devices with a real pointer get the follow behaviour, and only when
   * the visitor has not asked for less motion. Both are read once — they do
   * not change while somebody is reading a page.
   */
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPointerFine(fine && !still);
  }, []);

  useEffect(() => {
    if (!pointerFine) return;

    const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

    const tick = () => {
      current.current.x = lerp(current.current.x, target.current.x, 0.14);
      current.current.y = lerp(current.current.y, target.current.y, 0.14);
      const node = previewRef.current;
      if (node) {
        node.style.transform = `translate3d(${current.current.x + FOLLOW_OFFSET.x}px, ${
          current.current.y + FOLLOW_OFFSET.y
        }px, 0)`;
      }
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
    // Runs once. The mouse position is a ref precisely so it is not a
    // dependency — the loop must outlive every movement, not restart on each.
  }, [pointerFine]);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!pointerFine) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      target.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    },
    [pointerFine],
  );

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} onPointerMove={onPointerMove} className="relative">
      {/* The floating picture. Absolute inside the list rather than fixed to
          the viewport, so it scrolls with the section it belongs to. */}
      {pointerFine && (
        <div
          ref={previewRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-20 hidden lg:block"
          style={{
            opacity: active === null ? 0 : 1,
            transition: 'opacity 260ms var(--ease-out)',
            willChange: 'transform',
          }}
        >
          <div className="relative h-[210px] w-[320px] overflow-hidden rounded-[var(--r-md)] border border-overlay/10 bg-card shadow-[var(--shadow-float)]">
            {items.map((item, index) => (
              <img
                key={index}
                src={item.imageUrl || item.logoUrl || ''}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  opacity: active === index ? 1 : 0,
                  transform: active === index ? 'scale(1)' : 'scale(1.06)',
                  transition:
                    'opacity 420ms var(--ease-out), transform 420ms var(--ease-out)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      <ul className="relative">
        {items.map((item, index) => {
          const category = t(item.category);
          const description = t(item.description);
          const href = item.website?.trim();
          const Row = href ? 'a' : 'div';

          return (
            <li key={index} className="border-t border-overlay/10 last:border-b">
              <Row
                {...(href ? { href, target: '_blank', rel: 'noreferrer noopener' } : {})}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="group flex flex-col gap-4 py-7 transition-colors sm:flex-row sm:items-center sm:gap-8"
              >
                {/* The name, at a size that says this is the point of the row. */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <h3 className="display-3 min-w-0 text-fg">
                      <span className="relative inline-block">
                        {item.name}
                        <span
                          aria-hidden
                          className="absolute -bottom-1 left-0 h-px bg-current transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                          style={{ width: active === index ? '100%' : 0 }}
                        />
                      </span>
                    </h3>
                    {href && (
                      <ArrowUpRight
                        className="h-5 w-5 shrink-0 text-faint transition-all duration-300"
                        style={{
                          opacity: active === index ? 1 : 0,
                          transform:
                            active === index ? 'translate(0,0)' : 'translate(-6px, 6px)',
                        }}
                      />
                    )}
                  </div>

                  {description && (
                    <p className="prose-measure mt-2 text-sm">{description}</p>
                  )}
                </div>

                {/* On a touch screen the picture belongs in the row: there is
                    no cursor to follow, and a list of names with the images
                    hidden behind an interaction nobody can perform is a list
                    with its pictures deleted. */}
                {!pointerFine && (item.imageUrl || item.logoUrl) && (
                  <div className="h-40 w-full overflow-hidden rounded-[var(--r-md)] border border-overlay/10 bg-overlay/[0.03] sm:h-24 sm:w-40 sm:shrink-0">
                    <img
                      src={item.imageUrl || item.logoUrl || ''}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                {category && (
                  <span className="shrink-0 text-xs uppercase tracking-[0.14em] text-faint">
                    {category}
                  </span>
                )}
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
