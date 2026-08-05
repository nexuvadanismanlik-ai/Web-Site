import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Inter, Space_Grotesk } from 'next/font/google';
import { getSiteContent } from '../lib/content';
import { t, getUi } from '../lib/i18n';
import { Header } from '../components/site/header';
import { Footer } from '../components/site/footer';
import { EditOverlay } from '../components/edit-overlay';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: {
      default: `${content.brand.siteName} — ${t(content.brand.tagline)}`,
      template: `%s | ${content.brand.siteName}`,
    },
    description: t(content.hero.subtitle),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const content = await getSiteContent();
  const ui = getUi();

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
      className={`${inter.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body style={brandStyle}>
        <Header
          logoText={content.brand.logoText}
          logoUrl={content.brand.logoUrl ?? ''}
          nav={nav}
          ctaLabel={ui.getStarted}
        />
        <main className="relative">{children}</main>
        <Footer content={content} />
        <EditOverlay />
      </body>
    </html>
  );
}
