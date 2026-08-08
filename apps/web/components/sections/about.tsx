import type { AboutContent } from '@nexuva/types';
import { t } from '../../lib/i18n';
import { Icon } from '../icon';
import { Reveal, Stagger, StaggerItem } from '../motion';
import { DisciplineVisual } from './discipline-visual';

export function About({
  about,
  hideHeading = false,
}: {
  about: AboutContent;
  hideHeading?: boolean;
}) {
  return (
    <section id="about" className="section">
      <div className="container-x">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* Text column */}
          <div>
            {!hideHeading && (
              <>
                <Reveal>
                  <span className="eyebrow" data-edit="about.badge">
                    <span className="h-1.5 w-1.5 rounded-full brand-gradient-bg" />
                    {t(about.badge)}
                  </span>
                </Reveal>
                <Reveal delay={0.05}>
                  <h2
                    className="mt-5 font-heading text-3xl font-bold text-fg text-balance sm:text-4xl md:text-[2.6rem] md:leading-[1.1]"
                    data-edit="about.title"
                  >
                    {t(about.title)}
                  </h2>
                </Reveal>
              </>
            )}
            <div className={hideHeading ? 'space-y-4' : 'mt-6 space-y-4'}>
              {about.paragraphs.map((p, i) => (
                <Reveal key={i} delay={0.1 + i * 0.05}>
                  <p
                    className="text-base leading-relaxed text-muted"
                    data-edit={`about.paragraphs.${i}`}
                  >
                    {t(p)}
                  </p>
                </Reveal>
              ))}
            </div>

            {/* The team, the office, the work. A section about who we are that
                shows nobody is a section of adjectives.
                Until there is a photograph, the diagram draws the claim the
                paragraph above already makes — four disciplines in one team —
                which is a picture of something true rather than a stock image
                of strangers at laptops. Uploading a photo replaces it. */}
            <Reveal delay={0.2}>
              <div className="mt-8">
                {about.image ? (
                  <div className="overflow-hidden rounded-2xl border border-overlay/10 shadow-card">
                    <img
                      src={about.image}
                      alt={about.imageAlt ?? ''}
                      loading="lazy"
                      className="block h-auto w-full"
                    />
                  </div>
                ) : (
                  <DisciplineVisual />
                )}
              </div>
            </Reveal>
          </div>

          {/* Highlights column */}
          <Stagger className="grid gap-5 sm:grid-cols-2" gap={0.08}>
            {about.highlights.map((h, i) => (
              <StaggerItem key={i}>
                <div
                  className={`card-surface h-full p-6 ${i % 2 === 1 ? 'sm:mt-8' : ''}`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient-bg shadow-glow-brand">
                    <Icon name={h.icon} className="h-5 w-5 text-white" />
                  </div>
                  <h3
                    className="mt-5 font-heading text-lg font-semibold text-fg"
                    data-edit={`about.highlights.${i}.title`}
                  >
                    {t(h.title)}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed text-muted"
                    data-edit={`about.highlights.${i}.text`}
                  >
                    {t(h.text)}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
