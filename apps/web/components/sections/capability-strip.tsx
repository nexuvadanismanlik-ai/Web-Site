import type { CSSProperties } from 'react';

/**
 * A quiet line of what this company does, moving slowly under the hero.
 *
 * It stands where the client-logo strip goes, and only when there are no logos
 * yet. The alternative was the gap that is there now: the hero ends and the
 * services grid begins, with nothing in between, which is the join a reader
 * feels as "this page has run out of things to say already".
 *
 * Deliberately not a row of invented client marks. The names here are the
 * services themselves, read from the panel — so the strip is true the moment it
 * renders and it changes when the services change. No `data-edit` on them: they
 * are already editable where they are defined, and two elements claiming the
 * same field is how a visual editor ends up writing to the wrong one.
 *
 * The moment a real logo is uploaded this disappears and the trust strip takes
 * the slot back. Borrowed space, returned on demand.
 */
export function CapabilityStrip({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  // Doubled so the track can loop seamlessly; tripled when the list is short,
  // because two copies of three names leaves a visible gap on a wide screen.
  const repeats = items.length < 5 ? 3 : 2;
  const line = Array.from({ length: repeats }, () => items).flat();

  return (
    <section className="border-y border-overlay/[0.07] py-7" aria-hidden>
      <div className="marquee-mask pause-on-hover overflow-hidden">
        <div
          className="marquee-track animate-marquee items-center"
          style={{ '--marquee-duration': '58s' } as CSSProperties}
        >
          {line.map((item, i) => (
            <span key={`${item}-${i}`} className="flex select-none items-center">
              <span className="whitespace-nowrap px-7 font-heading text-lg text-faint sm:text-xl">
                {item}
              </span>
              {/* A small rotated square in the brand gold. A bullet would read
                  as a list; this reads as a rule with punctuation. */}
              <span
                className="h-1 w-1 rotate-45"
                style={{ background: 'var(--gold)', opacity: 0.55 }}
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
