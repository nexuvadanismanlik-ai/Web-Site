import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SUPPORTED_LOCALES } from '@nexuva/shared';
import '../globals.css';

interface LocaleLayoutProps {
  children: ReactNode;
  params: { locale: string };
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: {
    default: 'Nexuva Danışmanlık',
    template: '%s | Nexuva',
  },
  description: 'Dijital dönüşüm, kurumsal danışmanlık ve yazılım ürünleri.',
};

export default function LocaleLayout({ children, params }: LocaleLayoutProps) {
  return (
    <html lang={params.locale} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
