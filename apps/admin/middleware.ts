import { type NextRequest, NextResponse } from 'next/server';
import { ADMIN_BASE_PATH, adminPath } from './lib/routes';

/** Routes reachable without a session, expressed relative to the admin root. */
const PUBLIC_PATHS = ['/login', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Once the panel is mounted under a base path, only its own subtree is
  // guarded — the public site must not be forced through this check.
  if (ADMIN_BASE_PATH && !pathname.startsWith(ADMIN_BASE_PATH)) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(adminPath(p)))) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get('next-auth.session-token')?.value ??
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  if (!token) {
    const loginUrl = new URL(adminPath('/login'), request.url);
    // Full pathname, so the post-login redirect lands on the right URL whether
    // or not a base path is in play.
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
