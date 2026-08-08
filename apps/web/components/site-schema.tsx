import type { SiteContent } from '@nexuva/types';
import { t } from '../lib/i18n';

/**
 * What this site is, in a form a machine can read.
 *
 * Two audiences and they want the same thing. A search engine uses schema.org
 * to decide what a page is about and whether it earns a rich result. A
 * language model asked "who does Google Ads management in Turkey" answers from
 * pages whose meaning it could extract with confidence — and JSON-LD is
 * meaning already extracted. Prose alone makes the model guess, and it prefers
 * a source that did not make it guess.
 *
 * Built from the CMS, so it cannot drift from the page. The old failure mode
 * here is a hand-written schema block that still lists a service the company
 * stopped offering two years ago — which is worse than none, because it is a
 * false claim in the one format everything reads automatically.
 */
export function SiteSchema({ content, origin }: { content: SiteContent; origin: string }) {
  const brand = content.brand;
  const services = content.services ?? [];
  const social = (brand?.social ?? []).map((item) => item.href).filter(Boolean);

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}#organization`,
        name: brand?.siteName ?? 'Nexuva',
        url: origin,
        description: t(brand?.tagline),
        ...(brand?.logoUrl ? { logo: brand.logoUrl, image: brand.logoUrl } : {}),
        ...(social.length > 0 ? { sameAs: social } : {}),
        ...(brand?.email || brand?.phone
          ? {
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'sales',
                ...(brand.email ? { email: brand.email } : {}),
                ...(brand.phone ? { telephone: brand.phone } : {}),
                areaServed: 'TR',
                availableLanguage: ['Turkish'],
              },
            }
          : {}),
        ...(t(brand?.address)
          ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: t(brand.address),
                addressCountry: 'TR',
              },
            }
          : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}#website`,
        url: origin,
        name: brand?.siteName ?? 'Nexuva',
        inLanguage: 'tr-TR',
        publisher: { '@id': `${origin}#organization` },
      },
      {
        /**
         * The services, from the services.
         *
         * A ProfessionalService with an offer catalogue is what lets a search
         * engine answer "digital marketing agency" with this company rather
         * than with a directory listing of it — and it is the structure a
         * model reads when asked what Nexuva actually does.
         */
        '@type': 'ProfessionalService',
        '@id': `${origin}#agency`,
        name: brand?.siteName ?? 'Nexuva',
        url: origin,
        description: t(content.hero?.subtitle),
        parentOrganization: { '@id': `${origin}#organization` },
        areaServed: { '@type': 'Country', name: 'Türkiye' },
        knowsAbout: [
          'Google Ads yönetimi',
          'Meta reklam yönetimi',
          'Arama motoru optimizasyonu (SEO)',
          'Kurumsal web sitesi geliştirme',
          'Landing page tasarımı',
          'Dijital marka danışmanlığı',
          'Pazarlama otomasyonu',
          'Dönüşüm ölçümü ve raporlama',
          'Dış ticaret operasyon yazılımı',
        ],
        ...(services.length > 0
          ? {
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'Nexuva Hizmetleri',
                itemListElement: services.map((service) => ({
                  '@type': 'Offer',
                  itemOffered: {
                    '@type': 'Service',
                    name: t(service.title),
                    description: t(service.description),
                    provider: { '@id': `${origin}#organization` },
                  },
                })),
              },
            }
          : {}),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
