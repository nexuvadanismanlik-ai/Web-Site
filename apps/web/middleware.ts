import { type NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@nexuva/shared';

const PUBLIC_FILE = /\.(.*)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0] ?? '';

  const hasLocale = (SUPPORTED_LOCALES as readonly string[]).includes(firstSegment);

  if (!hasLocale) {
    const locale = detectLocale(request);
    return NextResponse.redirect(
      new URL(`/${locale}${pathname}`, request.url),
    );
  }

  const response = NextResponse.next();
  response.headers.set('x-nexuva-locale', firstSegment);
  return response;
}

function detectLocale(request: NextRequest): string {
  const acceptLanguage = request.headers.get('accept-language') ?? '';
  const preferred = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase() ?? '';
  return (SUPPORTED_LOCALES as readonly string[]).includes(preferred)
    ? preferred
    : DEFAULT_LOCALE;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
