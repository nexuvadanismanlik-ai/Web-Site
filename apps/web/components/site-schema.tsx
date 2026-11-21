import type { SiteContent } from '@nexuva/types';
import { t } from '../lib/i18n';
import { isProfileUrl, serializeJsonLd } from '../lib/seo';
import { absoluteUrl } from '../lib/origin';
import { servicePath } from '../lib/services';
import { COMPANY } from '../lib/verified-facts';
import { BRAND_DEFINITION } from '../lib/brand-identity';

/**
 * What this site is, in a form a machine can read.
 *
 * A search engine uses schema.org to decide what a page is about; a language
 * model answering "who does Google Ads management in Turkey" answers from pages
 * whose meaning it could extract with confidence. JSON-LD is that meaning,
 * already extracted — so everything in it must be true.
 *
 * Built from the CMS so it cannot drift from the page, with three filters:
 *   - the origin comes from deployment configuration, never the panel;
 *   - social links count only when they point at an actual profile;
 *   - phone and address appear only once confirmed (lib/verified-facts.ts).
 */
export function SiteSchema({ content, origin }: { content: SiteContent; origin: string }) {
  if (!origin) return null;

  const brand = content.brand;
  const services = content.services ?? [];
  const sameAs = (brand?.social ?? []).map((item) => item.href).filter(isProfileUrl);
  const phone = COMPANY.phoneE164;
  const home = absoluteUrl('/');
  const orgId = `${home}#organization`;
  // The approved definition, not the panel's footer text (which still calls
  // Nexuva an agency) — one description for every machine-facing surface.
  const description = BRAND_DEFINITION;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: brand?.siteName ?? 'Nexuva',
        url: home,
        ...(description ? { description } : {}),
        ...(brand?.logoUrl ? { logo: brand.logoUrl, image: brand.logoUrl } : {}),
        ...(sameAs.length > 0 ? { sameAs } : {}),
        ...(phone
          ? {
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'customer service',
                ...(brand?.email ? { email: brand.email } : {}),
                ...(phone ? { telephone: phone } : {}),
                areaServed: 'TR',
                availableLanguage: ['Turkish'],
              },
            }
          : {}),
        telephone: COMPANY.phoneE164,
        foundingDate: String(COMPANY.foundingYear),
        address: {
          '@type': 'PostalAddress',
          addressLocality: COMPANY.locality,
          addressRegion: COMPANY.region,
          addressCountry: 'TR',
        },
        areaServed: { '@type': 'Country', name: 'Türkiye' },
      },
      {
        '@type': 'WebSite',
        '@id': `${home}#website`,
        url: home,
        name: brand?.siteName ?? 'Nexuva',
        inLanguage: 'tr-TR',
        publisher: { '@id': orgId },
      },
      ...(services.length > 0
        ? [
            {
              '@type': 'ItemList',
              '@id': `${absoluteUrl('/services')}#list`,
              name: 'Nexuva hizmetleri',
              itemListElement: services.map((service, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: absoluteUrl(servicePath(service)),
                name: t(service.title),
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  );
}
