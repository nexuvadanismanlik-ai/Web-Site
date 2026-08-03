import { Inter, Space_Grotesk } from 'next/font/google';

export const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

export const fontVars = `${inter.variable} ${spaceGrotesk.variable}`;
