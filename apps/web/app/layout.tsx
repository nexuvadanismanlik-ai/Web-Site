import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Inter, Playfair_Display } from 'next/font/google';
import { getSiteContent } from '../lib/content';
import { isIndexableDeployment, siteOrigin } from '../lib/origin';
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
  // 500 is not used by any heading; dropping it removes two font files
  // (upright and italic) from every first visit. 600 is used by the footer's
  // column titles and card names, 700 by section headings and the logo.
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
});

/**
 * Site-wide metadata only.
 *
 * The root layout used to set canonical, description and the OpenGraph card,
 * and every inner page inherited them — so five pages declared themselves the
 * home page. Those now come from each page through lib/seo.ts; what stays here
 * is genuinely shared: the title template, the base for relative URLs, icons,
 * search-console verification, and the site-wide noindex switch.
 *
 * The origin comes from deployment configuration (lib/origin.ts). The panel's
 * canonical field is no longer read: it still held the old Render host.
 */
export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const seo = content.seo ?? ({} as Partial<NonNullable<typeof content.seo>>);
  const origin = siteOrigin();

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

  const hidden = seo.noIndex === true || !isIndexableDeployment();

  return {
    // metadataBase resolves relative image paths in every page's tags.
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: {
      default: `${content.brand.siteName} — ${t(content.brand.tagline)}`,
      template: `%s | ${content.brand.siteName}`,
    },
    applicationName: content.brand.siteName,
    // Only the deviation is stated. Pages are indexable by default; emitting
    // "index, follow" here is what put two contradictory robots tags on 404s.
    ...(hidden ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      siteName: content.brand.siteName,
      locale: 'tr_TR',
      type: 'website',
    },
    ...(seo.twitterSite?.trim() ? { twitter: { site: seo.twitterSite.trim() } } : {}),
    ...(Object.keys(icons).length > 0 ? { icons } : {}),
    ...(verification.google || verification.other ? { verification } : {}),
    // The published version this page was rendered from. After a publish the
    // API reads it back from the live site to confirm visitors are actually
    // being served the new content — an HTTP 200 from /api/revalidate alone
    // proves nothing about what the next visitor sees.
    ...(content.publication
      ? { other: { 'nexuva-content-version': String(content.publication.version) } }
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
        <SiteSchema content={content} origin={siteOrigin()} />
        <Analytics />
        <Integrations config={content.integrations} />
      </body>
    </html>
  );
}
