import type { ReactNode } from 'react';
import { fontVars } from '../../lib/fonts';
import '../globals.css';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className={fontVars} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
