import type { CSSProperties } from 'react';

export function LogosMarquee({ logos, label }: { logos: string[]; label: string }) {
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
              key={`${logo}-${i}`}
              data-edit={`logos.${i % logos.length}`}
              className="flex select-none items-center gap-2 whitespace-nowrap px-8 font-heading text-xl font-semibold text-faint transition-colors hover:text-fg"
            >
              <span className="h-2 w-2 rounded-full bg-overlay/20" />
              {logo}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
