import { Reveal } from '../motion';

/**
 * The opening of an inner page.
 *
 * Left-aligned rather than centred, and this is the only structural decision
 * here worth arguing. A centred column of text under a centred badge is what
 * every template does, and it fights the rest of the site: the home page,
 * every section heading and the reference list all start at the same left
 * edge, so a centred inner page reads as a different website.
 *
 * The gold rule under the title does the work the grid pattern and the glow
 * used to do — it says "a page starts here" using the brand's own colour
 * instead of two decorative layers borrowed from nowhere in particular.
 */
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
    <section className="relative overflow-hidden pt-36 pb-14 sm:pt-44 sm:pb-18">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(55% 40% at 50% 0%, color-mix(in srgb, var(--brand) 10%, transparent) 0%, transparent 70%)',
        }}
      />
      <div className="container-x">
        <div className="max-w-3xl">
          {badge && (
            <Reveal>
              <span className="eyebrow">{badge}</span>
            </Reveal>
          )}
          <Reveal delay={0.05}>
            <h1 className="display-1 mt-6 text-fg">{title}</h1>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rule-gold mt-8 w-28" />
          </Reveal>
          {subtitle && (
            <Reveal delay={0.14}>
              <p className="prose-measure mt-6 text-base sm:text-lg">{subtitle}</p>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
