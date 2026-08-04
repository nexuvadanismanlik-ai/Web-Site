import { type NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { hasRoleOrHigher } from '@nexuva/shared';
import type { UserRole } from '@nexuva/types';
import { ADMIN_BASE_PATH, adminPath } from './lib/routes';
import { sessionSecret, usesSecureCookie } from './lib/session-secret';

/** Routes reachable without a session, expressed relative to the admin root. */
const PUBLIC_PATHS = ['/login', '/api/auth'];

/**
 * Lowest role that may open the panel at all. It matches what the API requires
 * to read website content, so a session that gets past here can actually load a
 * page rather than reaching a wall of failed requests.
 */
const MINIMUM_ROLE: UserRole = 'CONTENT_EDITOR';

function isKnownRole(value: unknown): value is UserRole {
  return (
    value === 'SUPER_ADMIN' ||
    value === 'ADMIN' ||
    value === 'PRODUCT_MANAGER' ||
    value === 'CONTENT_EDITOR' ||
    value === 'VIEWER'
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Once the panel is mounted under a base path, only its own subtree is
  // guarded — the public site must not be forced through this check.
  if (ADMIN_BASE_PATH && !pathname.startsWith(ADMIN_BASE_PATH)) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(adminPath(p)))) {
    return NextResponse.next();
  }

  // Verifies the signature rather than merely noting that a cookie exists.
  // The previous check let any value through under the right cookie name.
  const token = await getToken({
    req: request,
    secret: sessionSecret(),
    secureCookie: usesSecureCookie(),
  });

  // `error` is set by the jwt callback when the refresh token is spent or
  // rejected: the cookie is still valid but the session behind it is dead.
  if (!token || token['error']) {
    return redirectToLogin(request, pathname);
  }

  const role = token['role'];
  if (!isKnownRole(role) || !hasRoleOrHigher(role, MINIMUM_ROLE)) {
    // Authenticated but not entitled. Sent to login rather than shown an empty
    // panel, and marked so the page can say why.
    return redirectToLogin(request, pathname, 'forbidden');
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, pathname: string, reason?: string) {
  const loginUrl = new URL(adminPath('/login'), request.url);
  // Full pathname, so the post-login redirect lands on the right URL whether
  // or not a base path is in play.
  loginUrl.searchParams.set('callbackUrl', pathname);
  if (reason) loginUrl.searchParams.set('error', reason);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
