import type { ServiceItem, SiteContent } from '@nexuva/types';
import { t } from './i18n';

/**
 * The address of each service page.
 *
 * Services live in the CMS without a slug field, and adding one is a schema
 * migration that has not been approved yet. Until it is, the slug is derived
 * here: the agreed addresses for the eight current services by their Turkish
 * title, and a transliterated title for anything added later. Renaming a
 * service in the panel to something outside this table changes its address —
 * the migration (see DATABASE_MIGRATION.md) moves the slug into the panel and
 * removes that risk.
 */
const AGREED_SLUGS: Record<string, string> = {
  'google ads yönetimi': 'google-ads',
  'meta reklam yönetimi': 'meta-ads',
  seo: 'seo',
  'kurumsal web sitesi': 'kurumsal-web-sitesi',
  'landing page': 'landing-page',
  'dijital marka danışmanlığı': 'marka-danismanligi',
  'otomasyon sistemleri': 'otomasyon',
  'logiops entegrasyonu': 'logiops-entegrasyonu',
};

const TR_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  i: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

export function slugify(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıiöşüâîû]/g, (ch) => TR_MAP[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' ve ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function serviceSlug(service: Pick<ServiceItem, 'title'>): string {
  const title = t(service.title).trim();
  const key = title.toLocaleLowerCase('tr-TR');
  return AGREED_SLUGS[key] ?? slugify(title);
}

export function servicePath(service: Pick<ServiceItem, 'title'>): string {
  return `/services/${serviceSlug(service)}`;
}

export function findServiceBySlug(
  content: Pick<SiteContent, 'services'>,
  slug: string,
): ServiceItem | undefined {
  return (content.services ?? []).find((service) => serviceSlug(service) === slug);
}
