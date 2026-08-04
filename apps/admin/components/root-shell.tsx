import type { ReactNode } from 'react';
import { fontVars } from '../lib/fonts';
import '../app/globals.css';

/**
 * The document shell for the admin as a standalone deployment: the <html> and
 * <body> elements, the font variables and the global stylesheet.
 *
 * All of this belongs to the host application once the panel moves inside the
 * public site — an app may only have one root layout. Keeping it in a single
 * component means that move is: replace <RootShell> with a fragment in the two
 * admin layouts and delete this file. See apps/admin/MERGE.md.
 */
export function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className={fontVars} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
