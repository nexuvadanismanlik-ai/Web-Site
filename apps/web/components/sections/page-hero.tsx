import { Reveal } from '../motion';

export function PageHero({
  badge,
  title,
  subtitle,
}: {
  badge?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="relative overflow-hidden pt-40 pb-16 sm:pt-48 sm:pb-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-80 w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand)_12%,transparent),transparent)]" />
        <div className="absolute inset-0 bg-grid-slate bg-[size:56px_56px] opacity-20 [mask-image:radial-gradient(60%_50%_at_50%_20%,black,transparent)]" />
      </div>
      <div className="container-x text-center">
        {badge && (
          <Reveal>
            <span className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
              {badge}
            </span>
          </Reveal>
        )}
        <Reveal delay={0.05}>
          <h1 className="mx-auto mt-5 max-w-3xl font-heading text-4xl font-bold text-fg text-balance sm:text-5xl md:text-6xl">
            {title}
          </h1>
        </Reveal>
        {subtitle && (
          <Reveal delay={0.1}>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              {subtitle}
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
