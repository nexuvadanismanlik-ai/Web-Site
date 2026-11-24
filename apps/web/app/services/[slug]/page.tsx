import type { Metadata } from 'next';
import { Icon } from '../../../components/icon';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSiteContent } from '../../../lib/content';
import { t } from '../../../lib/i18n';
import { absoluteUrl } from '../../../lib/origin';
import { pageMetadata, serializeJsonLd } from '../../../lib/seo';
import { findServiceBySlug, serviceSlug, servicePath } from '../../../lib/services';
import { SERVICE_DETAILS } from '../../../lib/service-details';
import { PageHero } from '../../../components/sections/page-hero';
import { Cta } from '../../../components/sections/cta';
import { Faq } from '../../../components/faq';

/**
 * One page per service.
 *
 * Eight services shared one URL as eight H3s, so none of them could rank for
 * its own search. Each now has an address, an H1 that names it, a description
 * written for that search, the questions people ask about it, and links to the
 * services usually needed alongside it.
 *
 * The page is built from the panel's service (title, description, bullets) plus
 * the long-form copy in lib/service-details.ts. A service added in the panel
 * without long-form copy still gets a page — built from the panel alone.
 */

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const content = await getSiteContent();
  return content.services.map((service) => ({ slug: serviceSlug(service) }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const content = await getSiteContent();
  const service = findServiceBySlug(content, params.slug);
  if (!service) return {};
  const detail = SERVICE_DETAILS[params.slug];
  return pageMetadata({
    path: servicePath(service),
    title: detail?.metaTitle ?? t(service.title),
    description: detail?.metaDescription ?? t(service.description),
  });
}

export default async function ServicePage({ params }: { params: Params }) {
  const content = await getSiteContent();
  const service = findServiceBySlug(content, params.slug);
  if (!service) notFound();

  const detail = SERVICE_DETAILS[params.slug];
  const title = t(service.title);
  const pageUrl = absoluteUrl(servicePath(service));
  const home = absoluteUrl('/');

  // The card's bullets first, then anything the long-form copy adds.
  const cardBullets = service.features.map((feature) => t(feature)).filter(Boolean);
  const scope = [
    ...cardBullets,
    ...(detail?.scope ?? []).filter(
      (item) =>
        !cardBullets.some((b) => b.toLocaleLowerCase('tr') === item.toLocaleLowerCase('tr')),
    ),
  ];

  const related = (detail?.related ?? [])
    .map((slug) => findServiceBySlug(content, slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const schema = pageUrl
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Service',
            '@id': `${pageUrl}#service`,
            name: title,
            serviceType: title,
            description: t(service.description),
            url: pageUrl,
            provider: { '@id': `${home}#organization` },
            areaServed: { '@type': 'Country', name: 'Türkiye' },
            ...(scope.length > 0
              ? {
                  hasOfferCatalog: {
                    '@type': 'OfferCatalog',
                    name: `${title} kapsamı`,
                    itemListElement: scope.map((item) => ({
                      '@type': 'Offer',
                      itemOffered: { '@type': 'Service', name: item },
                    })),
                  },
                }
              : {}),
          },
          {
            '@type': 'WebPage',
            '@id': pageUrl,
            url: pageUrl,
            name: detail?.metaTitle ?? title,
            inLanguage: 'tr-TR',
            isPartOf: { '@id': `${home}#website` },
            about: { '@id': `${pageUrl}#service` },
          },
        ],
      }
    : null;

  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Hizmetler', href: '/services' },
          { label: title, href: servicePath(service) },
        ]}
        badge="Hizmet"
        title={detail?.heading ?? title}
        subtitle={t(service.description)}
      />

      <section className="section pt-0">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              {(detail?.intro ?? []).map((paragraph) => (
                <p key={paragraph} className="prose-measure text-base sm:text-lg">
                  {paragraph}
                </p>
              ))}
              {scope.length > 0 && (
                <>
                  <h2 className="display-3 text-fg pt-6">Neleri kapsar?</h2>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {scope.map((item) => (
                      <li
                        key={item}
                        className="border-overlay/10 bg-card text-fg flex items-start gap-3 rounded-[var(--r-md)] border p-4 text-sm transition-transform duration-200 hover:-translate-y-0.5"
                      >
                        <Icon name="check" className="text-brand-dyn mt-0.5 h-4 w-4 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            {detail && detail.forWhom.length > 0 && (
              <aside className="border-overlay/10 bg-card shadow-card rounded-[var(--r-lg)] border p-7">
                <h2 className="font-heading text-fg text-xl">Kimler için uygun?</h2>
                <ul className="mt-5 space-y-3">
                  {detail.forWhom.map((item) => (
                    <li key={item} className="text-muted text-sm leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/contact/" className="btn-primary mt-7 inline-flex">
                  Projenizi konuşalım
                </Link>
              </aside>
            )}
          </div>
        </div>
      </section>

      {detail && detail.steps.length > 0 && (
        <section className="section pt-0">
          <div className="container-x">
            <h2 className="display-2 text-fg">Nasıl ilerliyoruz?</h2>
            <div className="rule-gold mt-6 w-20" />
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {detail.steps.map((step, index) => (
                <li
                  key={step.title}
                  className="border-overlay/10 bg-card rounded-[var(--r-lg)] border p-6"
                >
                  <span aria-hidden className="font-heading text-faint text-sm tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-heading text-fg mt-3 text-lg">{step.title}</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {detail && (
        <Faq
          items={detail.faq}
          pageUrl={pageUrl || undefined}
          title={`${title} hakkında sık sorulan sorular`}
        />
      )}

      {related.length > 0 && (
        <section className="section pt-0" aria-labelledby="ilgili-hizmetler">
          <div className="container-x">
            <h2 id="ilgili-hizmetler" className="display-3 text-fg">
              İlgili hizmetler
            </h2>
            <ul className="mt-6 flex flex-wrap gap-3">
              {related.map((item) => (
                <li key={item.id}>
                  <Link
                    href={servicePath(item)}
                    className="border-overlay/15 text-fg hover:border-overlay/40 inline-flex rounded-full border px-4 py-2 text-sm transition-colors"
                  >
                    {t(item.title)}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/services/"
                  className="text-muted inline-flex rounded-full px-4 py-2 text-sm underline-offset-4 hover:underline"
                >
                  Tüm hizmetler
                </Link>
              </li>
            </ul>
          </div>
        </section>
      )}

      <Cta cta={content.cta} />

      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      )}
    </>
  );
}
