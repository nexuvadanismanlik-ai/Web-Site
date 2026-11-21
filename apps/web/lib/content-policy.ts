import type { SiteContent } from '@nexuva/types';
import { BRAND_DEFINITION } from './brand-identity';
import { COMPANY } from './verified-facts';

/**
 * What the site will not repeat from the panel, whatever the panel holds.
 *
 * The content database still carries seeded claims that were never verified
 * ("120+ brands", "8+ years", "Türkiye's leading brands", an example phone
 * number, a Levent address). The database is not edited from the website, so
 * the claims are removed here, on the server, before any page, footer, JSON-LD
 * block or llms.txt sees them. When the panel is corrected these rules simply
 * stop matching.
 */
export const UNVERIFIED_CLAIMS: readonly RegExp[] = [
  /\b120\s*\+/,
  /120['’]?\s*den fazla/i,
  /\b8\s*\+\s*(yıl|years?)/i,
  /öncü marka/i,
  /leading brands/i,
  /555\s?0100/,
  /Levent/i,
  /34330/,
  /holding/i,
];

type Localized = { tr?: string; en?: string } | undefined;

function hasClaim(value: Localized | string): boolean {
  if (!value) return false;
  const texts = typeof value === 'string' ? [value] : [value.tr ?? '', value.en ?? ''];
  return texts.some((text) => UNVERIFIED_CLAIMS.some((re) => re.test(text)));
}

const ADDRESS = { tr: COMPANY.address, en: 'Beylikdüzü, Istanbul' };
const DEFINITION = { tr: BRAND_DEFINITION, en: BRAND_DEFINITION };

export function applyContentPolicy(content: SiteContent): SiteContent {
  const about = content.about;
  const highlights = (about?.highlights ?? []).filter((h) => !hasClaim(h.text) && !hasClaim(h.title));
  const sinceHighlight = {
    icon: 'map-pin',
    title: { tr: COMPANY.since, en: 'Since 2022' },
    text: { tr: `${COMPANY.foundingYear}’den beri İstanbul ${COMPANY.locality}’nde çalışıyoruz.`, en: 'Working from Beylikdüzü, Istanbul since 2022.' },
  };
  const paragraphs = (about?.paragraphs ?? []).filter((p) => !hasClaim(p));

  const referencesMeta = content.referencesMeta;

  return {
    ...content,
    brand: { ...content.brand, phone: COMPANY.phone, address: ADDRESS },
    contact: { ...content.contact, phone: COMPANY.phone, address: ADDRESS },
    footer: { ...content.footer, about: DEFINITION },
    hero: { ...content.hero, metrics: [] },
    stats: (content.stats ?? []).filter((s) => !hasClaim(String(s.value)) && !hasClaim(s.label)),
    about: about
      ? {
          ...about,
          highlights: [sinceHighlight, ...highlights].slice(0, 4),
          paragraphs: [DEFINITION, ...paragraphs],
        }
      : about,
    referencesMeta: referencesMeta
      ? {
          ...referencesMeta,
          title: hasClaim(referencesMeta.title)
            ? { tr: 'Birlikte çalıştığımız markalar', en: 'Brands we work with' }
            : referencesMeta.title,
          subtitle: hasClaim(referencesMeta.subtitle) ? { tr: '', en: '' } : referencesMeta.subtitle,
        }
      : referencesMeta,
  };
}
