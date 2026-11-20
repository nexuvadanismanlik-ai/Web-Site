import { serializeJsonLd } from '../lib/seo';

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Questions and answers a visitor can read, with matching FAQPage markup.
 *
 * Built on <details>/<summary>: keyboard and screen-reader accessible without
 * any JavaScript, and the answers are in the HTML whether a panel is open or
 * not — which is what a crawler and a language model read. Each answer is
 * written to stand on its own, because that is how it gets quoted.
 *
 * The structured data is emitted from the same list that renders, so markup
 * for a question the page does not show cannot happen.
 */
export function Faq({
  id = 'sss',
  title = 'Sık sorulan sorular',
  items,
  pageUrl,
}: {
  id?: string;
  title?: string;
  items: FaqItem[];
  /** Absolute page URL; the FAQ is marked up only when it is known. */
  pageUrl?: string | undefined;
}) {
  if (items.length === 0) return null;

  const schema = pageUrl
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': `${pageUrl}#${id}`,
        mainEntity: items.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      }
    : null;

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="section">
      <div className="container-x">
        <div className="mx-auto max-w-3xl">
          <h2 id={`${id}-title`} className="display-2 text-fg">
            {title}
          </h2>
          <div className="rule-gold mt-6 w-20" />
          <div className="divide-overlay/10 border-overlay/10 mt-10 divide-y border-y">
            {items.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="text-fg flex cursor-pointer list-none items-start justify-between gap-6 text-left text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] sm:text-lg [&::-webkit-details-marker]:hidden">
                  <h3 className="font-sans text-base font-medium sm:text-lg">{item.question}</h3>
                  <span
                    aria-hidden
                    className="mt-1 shrink-0 text-xl leading-none transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="prose-measure mt-3 text-base">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      )}
    </section>
  );
}
