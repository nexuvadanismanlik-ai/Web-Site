import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Inter, Space_Grotesk } from 'next/font/google';
import { SUPPORTED_LOCALES } from '@nexuva/shared';
import { getSiteContent } from '../../lib/content';
import { normalizeLocale, t, getUi } from '../../lib/i18n';
import { Header } from '../../components/site/header';
import { Footer } from '../../components/site/footer';
import { EditOverlay } from '../../components/edit-overlay';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

interface LocaleLayoutProps {
  children: ReactNode;
  params: { locale: string };
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const content = await getSiteContent();
  const locale = normalizeLocale(params.locale);
  return {
    title: {
      default: `${content.brand.siteName} — ${t(content.brand.tagline, locale)}`,
      template: `%s | ${content.brand.siteName}`,
    },
    description: t(content.hero.subtitle, locale),
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const locale = normalizeLocale(params.locale);
  const content = await getSiteContent();
  const ui = getUi(locale);

  const nav = content.nav.map((item) => ({
    label: t(item.label, locale),
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
      lang={locale}
      data-theme={theme}
      className={`${inter.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body style={brandStyle}>
        <Header
          locale={locale}
          logoText={content.brand.logoText}
          nav={nav}
          ctaLabel={ui.getStarted}
        />
        <main className="relative">{children}</main>
        <Footer content={content} locale={locale} />
        <EditOverlay />
      </body>
    </html>
  );
}
