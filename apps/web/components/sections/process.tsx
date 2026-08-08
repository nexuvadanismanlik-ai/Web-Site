'use client';

import { useRef } from 'react';
import type { ProcessStep, SectionMeta } from '@nexuva/types';
import { t } from '../../lib/i18n';
import { Icon } from '../icon';
import { SectionHeading } from './section-heading';
import { ScrollRail } from '../scroll-rail';
import { Stagger, StaggerItem } from '../motion';

/**
 * How the work goes, drawn as a route rather than listed as four boxes.
 *
 * The section used to be a grid of numbered squares under a static hairline —
 * accurate, and completely inert. A process is the one thing on a page that has
 * a direction, so the rule now fills as the reader moves through it: downwards
 * on a phone, left to right on a desktop, driven by nothing but scroll
 * position. The reader's own progress through the section is the animation.
 *
 * One set of markup, two rails. Duplicating the steps per breakpoint would have
 * been easier to write and would have put two elements on the page carrying the
 * same `data-edit` path — which is what the visual editor uses to find the
 * field a click belongs to. Two matches is an editor that edits the wrong one.
 */
export function Process({
  meta,
  steps,
}: {
  meta: SectionMeta;
  steps: ProcessStep[];
}) {
  const track = useRef<HTMLDivElement>(null);
  if (steps.length === 0) return null;

  return (
    <section className="section">
      <div className="container-x">
        <SectionHeading meta={meta} basePath="processMeta" />

        <div ref={track} className="relative mt-16">
          {/* The rails sit behind the nodes at the exact offset the nodes are
              centred on: 11px from the left on a phone, 11px from the top on a
              desktop, which is the middle of a 22px marker. */}
          <ScrollRail
            target={track}
            orientation="vertical"
            className="bottom-0 left-[0.6875rem] top-0 lg:hidden"
          />
          <ScrollRail
            target={track}
            orientation="horizontal"
            className="left-0 right-0 top-[0.6875rem] hidden lg:block"
          />

          {/* One column until the four fit side by side. A two-column tablet
              layout would put half the markers nowhere near the vertical rail,
              and a rail the nodes do not sit on is worse than no rail. */}
          <Stagger className="grid gap-9 lg:grid-cols-4 lg:gap-8" gap={0.12}>
            {steps.map((step, i) => (
              <StaggerItem key={step.id} className="relative pl-12 lg:pl-0 lg:pt-14">
                {/* The marker on the rail. A ring rather than a filled disc, so
                    the gold beam reads as passing through it rather than
                    stopping at it. */}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 flex h-[1.375rem] w-[1.375rem] items-center justify-center rounded-full"
                  style={{
                    background: 'rgb(var(--c-page))',
                    border: '1px solid color-mix(in srgb, var(--gold) 50%, transparent)',
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: 'var(--gold)' }}
                  />
                </span>

                {step.imageUrl ? (
                  <div className="mb-5 aspect-[4/3] overflow-hidden rounded-[var(--r-md)] border border-overlay/10 shadow-[var(--shadow-raise)]">
                    <img
                      src={step.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="flex items-center gap-3">
                  {/* The step number, set in the display face. Four cards with
                      no numbers are four cards; numbered, they are an order. */}
                  <span
                    aria-hidden
                    className="font-heading text-sm tabular-nums text-faint"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {step.icon && !step.imageUrl && (
                    <Icon name={step.icon} className="h-4 w-4 text-brand-dyn" />
                  )}
                </div>

                <h3
                  className="mt-2 font-heading text-lg text-fg"
                  data-edit={`process.${i}.title`}
                >
                  {t(step.title)}
                </h3>
                <p
                  className="mt-2 text-sm leading-relaxed text-muted"
                  data-edit={`process.${i}.description`}
                >
                  {t(step.description)}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
