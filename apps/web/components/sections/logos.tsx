import type { CSSProperties } from 'react';
import type { LogoItem } from '@nexuva/types';

/**
 * The trust strip.
 *
 * Shows the mark when there is one and the name when there is not, so a client
 * can be listed the day they are won rather than the day their logo turns up.
 * Marks are greyed until hovered — a row of full-colour logos competes with the
 * page it is meant to support.
 */
export function LogosMarquee({ logos, label }: { logos: LogoItem[]; label: string }) {
  // An empty strip renders nothing rather than an empty frame under a heading
  // promising trusted brands. This is what lets placeholder content be deleted
  // without leaving a hole in the page: the section reappears by itself when
  // real logos are added in the panel.
  if (logos.length === 0) return null;

  const items = [...logos, ...logos];
  return (
    <section className="border-y border-overlay/5 py-14">
      <div className="container-x mb-9">
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-faint">
          {label}
        </p>
      </div>
      <div className="marquee-mask pause-on-hover overflow-hidden">
        <div
          className="marquee-track animate-marquee items-center"
          style={{ '--marquee-duration': '40s' } as CSSProperties}
        >
          {items.map((logo, i) => (
            <div
              key={`${logo.name}-${i}`}
              className="flex select-none items-center px-8"
            >
              {logo.imageUrl ? (
                <img
                  src={logo.imageUrl}
                  alt={logo.name}
                  loading="lazy"
                  className="h-9 w-auto max-w-[10rem] object-contain opacity-55 grayscale transition duration-500 hover:opacity-100 hover:grayscale-0"
                />
              ) : (
                <span
                  data-edit={`logos.${i % logos.length}`}
                  className="flex items-center gap-2 whitespace-nowrap font-heading text-xl font-semibold text-faint transition-colors hover:text-fg"
                >
                  <span className="h-2 w-2 rounded-full bg-overlay/20" />
                  {logo.name}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
