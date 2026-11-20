import type { Metadata } from 'next';
import { absoluteUrl, isIndexableDeployment } from './origin';

/**
 * Per-page metadata, built the same way everywhere.
 *
 * Every inner page used to set a title and nothing else, so it inherited the
 * home page's canonical, description and OpenGraph card from the root layout.
 * To a search engine that is five URLs declaring themselves copies of the home
 * page; it indexes one and drops the rest. Each page now states its own
 * address, its own description and its own card, and the root layout keeps
 * only what is genuinely site-wide.
 */
export interface PageSeo {
  /** Site path, e.g. '/services'. Trailing slash is added. */
  path: string;
  /** Shown in the tab and results; the layout appends " | Nexuva". */
  title: string;
  /** Use `title` as is, without the site-name suffix (the home page). */
  absoluteTitle?: boolean;
  description: string;
  /** Social card title, when it should differ from `title`. */
  socialTitle?: string | undefined;
  /** Absolute or site-relative image for the social card. */
  image?: string | undefined;
  /** Keep this page out of search results. */
  noIndex?: boolean;
  /** OpenGraph type; 'website' unless the page is something more specific. */
  ogType?: 'website' | 'article';
}

export function pageMetadata(page: PageSeo): Metadata {
  const url = absoluteUrl(page.path);
  const description = clampDescription(page.description);
  const socialTitle = page.socialTitle ?? page.title;
  const image = page.image ?? '/og.png';
  const indexable = !page.noIndex && isIndexableDeployment();

  return {
    title: page.absoluteTitle ? { absolute: page.title } : page.title,
    description,
    ...(url
      ? {
          alternates: {
            canonical: url,
            // One language today. Declaring it (and x-default) costs nothing
            // and means adding an English version later is additive, not a
            // re-crawl of every page.
            languages: { 'tr-TR': url, 'x-default': url },
          },
        }
      : {}),
    // Only the deviation is emitted. The layout no longer states "index,
    // follow" for every page, which is how the 404 page ended up carrying two
    // contradictory robots tags.
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: page.ogType ?? 'website',
      locale: 'tr_TR',
      title: socialTitle,
      description,
      ...(url ? { url } : {}),
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [image],
    },
  };
}

/**
 * Trims a description to what a results page shows, at a word boundary.
 *
 * Google truncates around 155–160 characters; a sentence cut mid-word reads
 * like a bug in the one line a searcher sees before deciding to click.
 */
export function clampDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s,;:.–—-]+$/u, '')}…`;
}

/**
 * Serialises a JSON-LD graph so it cannot close its own <script> tag.
 *
 * JSON.stringify leaves `<`, `>` and `&` as they are, so a CMS field containing
 * `</script><script>…` would end the JSON-LD block and run as a script on every
 * page. Escaping them as unicode sequences keeps the JSON identical to a parser
 * and inert to the HTML tokenizer. U+2028/U+2029 are escaped because they are
 * line terminators in older JavaScript parsers.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}

/**
 * A social profile link that actually identifies an account.
 *
 * The panel shipped with placeholder links to the networks' home pages
 * (https://linkedin.com, https://x.com …). In `sameAs` those tell every entity
 * resolver that Nexuva *is* LinkedIn. A profile URL has a path; a home page
 * does not.
 */
export function isProfileUrl(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:') return false;
    const path = url.pathname.replace(/\/+$/, '');
    return path.length > 1;
  } catch {
    return false;
  }
}
