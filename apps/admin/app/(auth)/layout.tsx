import type { ReactNode } from 'react';
import '../globals.css';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
