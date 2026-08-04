/**
 * Every admin URL is built through here.
 *
 * The panel ships today as its own deployment, so it lives at the root of its
 * own domain and the prefix is empty. It is destined to become a route subtree
 * of the public site at nexuva.com/web/admin.
 *
 * This helper covers the LINK side of that move: hrefs, redirects, auth
 * callbacks and revalidation paths all derive from it, so none of them have to
 * be edited. The FILES still have to move into the host app — setting the env
 * var alone would point links at /web/admin while the routes still answered at
 * /hero. See apps/admin/MERGE.md for the full procedure.
 *
 * NEXT_PUBLIC_ so client components (nav links, signOut) see it too.
 *
 * Do NOT combine this with Next's own `basePath` config: Next already prefixes
 * every href when basePath is set, so both together yield
 * /web/admin/web/admin/hero. Use one or the other — the merge uses this one.
 */
const RAW_BASE = process.env['NEXT_PUBLIC_ADMIN_BASE_PATH'] ?? '';

/** Normalised: no trailing slash, leading slash when non-empty. */
export const ADMIN_BASE_PATH = RAW_BASE.replace(/\/+$/, '');

/**
 * Builds an absolute in-app URL for an admin route.
 * `adminPath('/')` → '/' today, '/web/admin' once relocated.
 */
export function adminPath(path: string): string {
  const suffix = path === '/' ? '' : path;
  return `${ADMIN_BASE_PATH}${suffix}` || '/';
}

/**
 * True when `pathname` (as returned by usePathname) is the given admin route.
 * Comparing raw strings would break the moment the base path is non-empty.
 */
export function isAdminRoute(pathname: string | null, path: string): boolean {
  return pathname === adminPath(path);
}

/** Strips the base path off a real pathname, e.g. for callbackUrl round-trips. */
export function toAdminRelative(pathname: string): string {
  if (!ADMIN_BASE_PATH) return pathname;
  return pathname.startsWith(ADMIN_BASE_PATH)
    ? pathname.slice(ADMIN_BASE_PATH.length) || '/'
    : pathname;
}
