import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Inter, Playfair_Display } from 'next/font/google';
import { getSiteContent } from '../lib/content';
import { siteOrigin } from '../lib/origin';
import { t, getUi } from '../lib/i18n';
import { Header } from '../components/site/header';
import { Footer } from '../components/site/footer';
import { EditOverlay } from '../components/edit-overlay';
import { Analytics } from '../components/analytics';
import { Integrations } from '../components/integrations';
import { SiteSchema } from '../components/site-schema';
import './globals.css';

/**
 * The type system, chosen from the logo rather than from fashion.
 *
 * Nexuva's mark is a high-contrast classical serif — a fine-stroked N in a
 * double ring, with NEXUVA set in the same letterforms beneath. The site was
 * setting every headline in Space Grotesk, a geometric sans, which is the
 * typeface every AI-generated landing page in the world is currently wearing.
 * That single choice is most of why the site read as a template: it looked
 * like nobody's brand in particular, least of all this one.
 *
 * Playfair Display is the closest widely available match to the wordmark, and
 * pairing a classical serif headline with a neutral sans body is what makes
 * editorial and consultancy work look expensive. Inter stays for body text
 * because a display serif at 15px is a readability problem, not a statement.
 *
 * `latin-ext` on both, and this is not optional: ğ, ş, İ and ı live there.
 * Without it the browser silently substitutes another face for those letters
 * and Turkish words come out in two different typefaces.
 */
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
});

/**
 * Everything the panel's SEO screen controls, with the fallbacks it promises.
 *
 * The site had a title and a description and nothing else: no canonical, no
 * OpenGraph, no Twitter card, no icons. A link to it shared anywhere rendered
 * as a bare URL with no image, and the browser tab carried the default globe.
 *
 * Every field falls back to something derived from brand and hero content, so
 * an SEO section that has never been filled in leaves the site exactly as it
 * was rather than stripping what it already said.
 */
export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const seo = content.seo ?? ({} as Partial<NonNullable<typeof content.seo>>);

  const origin = siteOrigin(content);
  const fallbackTitle = `${content.brand.siteName} — ${t(content.brand.tagline)}`;
  const title = seo.title?.trim() || fallbackTitle;
  const description = seo.description?.trim() || t(content.hero.subtitle);
  const canonical = seo.canonical?.trim() || origin;
  const ogTitle = seo.ogTitle?.trim() || title;
  const ogDescription = seo.ogDescription?.trim() || description;
  /**
   * The picture that appears when a link to this site is shared.
   *
   * A chain rather than a single field, because a site without one renders as
   * a bare URL wherever it is posted — which, for a company selling digital
   * marketing, is an unfortunate advert. The panel's own choice wins; failing
   * that the hero picture, which is a real image of the work and is almost
   * always set; failing that the logo.
   *
   * The last link is a real 1200×630 card shipped with the site
   * (scripts/make-og-image.mjs), so the chain can no longer end in nothing.
   * It had, until recently: every field above it was empty and links to this
   * site rendered as bare URLs everywhere they were posted. A fallback whose
   * last step is `''` is not a fallback.
   */
  const ogImage =
    seo.ogImage?.trim() ||
    content.hero?.image?.trim() ||
    content.brand?.logoUrl?.trim() ||
    '/og.png';

  const integrations = content.integrations ?? {};
  const verification: { google?: string; other?: Record<string, string> } = {};
  if (integrations.googleSiteVerification?.trim()) {
    verification.google = integrations.googleSiteVerification.trim();
  }
  const other: Record<string, string> = {};
  if (integrations.bingSiteVerification?.trim()) {
    other['msvalidate.01'] = integrations.bingSiteVerification.trim();
  }
  if (integrations.yandexVerification?.trim()) {
    other['yandex-verification'] = integrations.yandexVerification.trim();
  }
  if (Object.keys(other).length > 0) verification.other = other;

  const icons: NonNullable<Metadata['icons']> = {};
  if (seo.favicon?.trim()) icons.icon = seo.favicon.trim();
  if (seo.appleTouchIcon?.trim()) icons.apple = seo.appleTouchIcon.trim();

  return {
    // metadataBase resolves any relative image path in the tags below. Without
    // it Next emits a warning and social networks receive a relative URL they
    // cannot fetch.
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: {
      default: title,
      template: `%s | ${content.brand.siteName}`,
    },
    description,
    ...(seo.keywords && seo.keywords.length > 0 ? { keywords: seo.keywords } : {}),
    ...(canonical ? { alternates: { canonical } } : {}),
    // noIndex is off unless somebody deliberately turns it on, and the panel
    // says in as many words what turning it on does.
    robots: seo.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName: content.brand.siteName,
      title: ogTitle,
      description: ogDescription,
      ...(canonical ? { url: canonical } : {}),
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
      locale: 'tr_TR',
    },
    twitter: {
      card: (seo.twitterCard === 'summary' ? 'summary' : 'summary_large_image') as
        | 'summary'
        | 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      ...(seo.twitterSite?.trim() ? { site: seo.twitterSite.trim() } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    ...(Object.keys(icons).length > 0 ? { icons } : {}),
    // Search-console ownership proofs. Plain strings the panel supplies; the
    // consoles read them from the head and nothing else does.
    ...(verification.google || verification.other
      ? { verification }
      : {}),
  };
}


export default async function RootLayout({ children }: { children: ReactNode }) {
  const content = await getSiteContent();
  const ui = getUi(content.uiText);

  const nav = content.nav.map((item) => ({
    label: t(item.label),
    href: item.href,
  }));

  const theme = content.brand.theme === 'dark' ? 'dark' : 'light';

  const brandStyle = {
    '--brand': content.brand.primaryColor,
    // In dark mode the gradient start needs lightening to pop on near-black;
    // in light mode the raw brand color is the readable choice.
    '--brand-2':
      theme === 'dark'
        ? `color-mix(in srgb, ${content.brand.primaryColor} 68%, white)`
        : content.brand.primaryColor,
    '--accent': content.brand.accentColor,
  } as CSSProperties;

  return (
    <html
      lang="tr"
      data-theme={theme}
      className={`${inter.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <body style={brandStyle}>
        <Header
          logoText={content.brand.logoText}
          logoUrl={content.brand.logoUrl ?? ''}
          nav={nav}
          ctaLabel={content.brand.headerCta?.label?.tr || ui.getStarted}
          ctaHref={content.brand.headerCta?.href || '/contact'}
        />
        <main className="relative">{children}</main>
        <Footer content={content} />
        <EditOverlay />
        {/* What this site is, for search engines and for the models that
            answer questions about it. Built from the CMS so it cannot drift
            from the page. */}
        <SiteSchema content={content} origin={siteOrigin(content)} />
        <Analytics />
        <Integrations config={content.integrations} />
      </body>
    </html>
  );
}
