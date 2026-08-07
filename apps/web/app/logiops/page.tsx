import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getSiteContent } from '../../lib/content';
import { t } from '../../lib/i18n';
import { Cta } from '../../components/sections/cta';
import { Reveal, Stagger, StaggerItem } from '../../components/motion';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const logiops = content.logiops;
  const title = [t(logiops?.titleLead), t(logiops?.titleHighlight)].filter(Boolean).join(' ');
  const description = t(logiops?.subtitle);
  return {
    title: title ? `LogiOps — ${title}` : 'LogiOps',
    // Only set when there is one: an explicit `undefined` is a different thing
    // from an absent key under exactOptionalPropertyTypes.
    ...(description ? { description } : {}),
  };
}

/**
 * The LogiOps page.
 *
 * A product page rather than a longer service card: it opens with what the
 * product is for, states the problem in the customer's words, then explains
 * the approach and what running it looks like. That order is the argument —
 * a page that opens with features is asking somebody to work out for
 * themselves whether they have the problem.
 *
 * Every word comes from the panel. Nothing is written here, which matters more
 * on this page than on any other: a product page is where a business is most
 * tempted to write a capability into the code, and a capability in code is one
 * nobody can correct without a deploy.
 *
 * Renders nothing at all if the section has never been filled in. An empty
 * product page linked from the main navigation is worse than no link.
 */
export default async function LogiOpsPage() {
  const content = await getSiteContent();
  const logiops = content.logiops;

  const lead = t(logiops?.titleLead);
  const highlight = t(logiops?.titleHighlight);

  if (!lead && !highlight) {
    return (
      <section className="section">
        <div className="container-x">
          <p className="prose-measure">
            Bu sayfa henüz hazırlanmadı.
          </p>
        </div>
      </section>
    );
  }

  const problems = logiops.problems ?? [];
  const approach = logiops.approach ?? [];
  const flow = logiops.flow ?? [];

  return (
    <>
      {/* ── Opening ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              'radial-gradient(60% 45% at 50% 0%, color-mix(in srgb, var(--brand) 12%, transparent) 0%, transparent 70%)',
          }}
        />
        <div className="container-x">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div>
              <Reveal>
                <span className="eyebrow" data-edit="logiops.badge">
                  {t(logiops.badge)}
                </span>
              </Reveal>
              <Reveal delay={0.06}>
                <h1 className="display-1 mt-7 text-fg">
                  <span data-edit="logiops.titleLead">{lead}</span>{' '}
                  <span
                    className="italic"
                    style={{ color: 'var(--gold)' }}
                    data-edit="logiops.titleHighlight"
                  >
                    {highlight}
                  </span>
                </h1>
              </Reveal>
              <Reveal delay={0.12}>
                <p className="lede mt-7" data-edit="logiops.subtitle">
                  {t(logiops.subtitle)}
                </p>
              </Reveal>
              <Reveal delay={0.18}>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  {t(logiops.primaryCta?.label) && (
                    <Link
                      href={logiops.primaryCta.href || '/contact'}
                      className="btn-primary"
                      data-cta="logiops-primary"
                      data-edit="logiops.primaryCta.label"
                    >
                      {t(logiops.primaryCta.label)}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  )}
                  {t(logiops.secondaryCta?.label) && (
                    <Link
                      href={logiops.secondaryCta.href || '/services'}
                      className="btn-ghost"
                      data-cta="logiops-secondary"
                      data-edit="logiops.secondaryCta.label"
                    >
                      {t(logiops.secondaryCta.label)}
                      <ArrowUpRight className="h-4 w-4 opacity-60" />
                    </Link>
                  )}
                </div>
              </Reveal>
            </div>

            {logiops.image && (
              <Reveal delay={0.24}>
                <div className="overflow-hidden rounded-[var(--r-lg)] border border-overlay/15 bg-card shadow-[var(--shadow-float)]">
                  <img
                    src={logiops.image}
                    alt={logiops.imageAlt ?? ''}
                    className="block h-auto w-full"
                    width={1200}
                    height={800}
                  />
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {/* ── The problem ─────────────────────────────────────────────────── */}
      {problems.length > 0 && (
        <section className="section border-t border-overlay/8">
          <div className="container-x">
            <Reveal>
              <h2 className="display-2 max-w-2xl text-fg" data-edit="logiops.problemsTitle">
                {t(logiops.problemsTitle)}
              </h2>
            </Reveal>
            <Stagger className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2" gap={0.07}>
              {problems.map((item, index) => (
                <StaggerItem key={index}>
                  <div className="border-t border-overlay/10 pt-6">
                    <h3
                      className="font-heading text-lg text-fg"
                      data-edit={`logiops.problems.${index}.title`}
                    >
                      {t(item.title)}
                    </h3>
                    <p
                      className="prose-measure mt-2 text-sm"
                      data-edit={`logiops.problems.${index}.body`}
                    >
                      {t(item.body)}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* ── The approach ────────────────────────────────────────────────── */}
      {approach.length > 0 && (
        <section className="section border-t border-overlay/8">
          <div className="container-x">
            <Reveal>
              <h2 className="display-2 max-w-2xl text-fg" data-edit="logiops.approachTitle">
                {t(logiops.approachTitle)}
              </h2>
            </Reveal>
            <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" gap={0.07}>
              {approach.map((item, index) => (
                <StaggerItem key={index}>
                  <div className="service-card h-full p-7">
                    <span
                      aria-hidden
                      className="font-heading text-sm tabular-nums"
                      style={{ color: 'var(--gold)' }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3
                      className="mt-4 font-heading text-lg text-fg"
                      data-edit={`logiops.approach.${index}.title`}
                    >
                      {t(item.title)}
                    </h3>
                    <p
                      className="mt-2 text-sm leading-relaxed text-muted"
                      data-edit={`logiops.approach.${index}.body`}
                    >
                      {t(item.body)}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* ── How it runs ─────────────────────────────────────────────────── */}
      {flow.length > 0 && (
        <section className="section border-t border-overlay/8">
          <div className="container-x">
            <Reveal>
              <h2 className="display-2 max-w-2xl text-fg" data-edit="logiops.flowTitle">
                {t(logiops.flowTitle)}
              </h2>
            </Reveal>
            {/* A single connected line rather than four numbered boxes: the
                point of a flow is that one step leads to the next, and boxes
                say the opposite. */}
            <ol className="relative mt-12 border-l border-overlay/12 pl-8 sm:pl-10">
              {flow.map((item, index) => (
                <li key={index} className="relative pb-10 last:pb-0">
                  <span
                    aria-hidden
                    className="absolute -left-[calc(2rem+1px)] top-1 flex h-4 w-4 items-center justify-center rounded-full sm:-left-[calc(2.5rem+1px)]"
                    style={{
                      background: 'rgb(var(--c-page))',
                      border: '1px solid var(--gold)',
                    }}
                  />
                  <h3
                    className="font-heading text-lg text-fg"
                    data-edit={`logiops.flow.${index}.title`}
                  >
                    {t(item.title)}
                  </h3>
                  <p
                    className="prose-measure mt-2 text-sm"
                    data-edit={`logiops.flow.${index}.body`}
                  >
                    {t(item.body)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ── Closing ─────────────────────────────────────────────────────── */}
      {t(logiops.closingTitle) && (
        <section className="section border-t border-overlay/8">
          <div className="container-x">
            <Reveal>
              <div className="mx-auto max-w-3xl text-center">
                <div className="rule-gold mx-auto mb-8 w-24" aria-hidden />
                <h2 className="display-2 text-fg" data-edit="logiops.closingTitle">
                  {t(logiops.closingTitle)}
                </h2>
                <p
                  className="prose-measure mx-auto mt-5"
                  data-edit="logiops.closingBody"
                >
                  {t(logiops.closingBody)}
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <Cta cta={content.cta} />
    </>
  );
}
