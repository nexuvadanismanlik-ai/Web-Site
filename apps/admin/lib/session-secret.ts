/**
 * The key that signs admin session cookies.
 *
 * Kept in its own module because both NextAuth's options and the middleware
 * need it, and the middleware must not pull the provider setup into the edge
 * bundle to get at it.
 *
 * There is deliberately no committed fallback. A default value in source is a
 * published signing key: anyone reading the repository could mint a session
 * cookie the panel would accept. Production refuses to run without a real one;
 * development gets a value that is obviously unusable anywhere else.
 */
const DEVELOPMENT_ONLY_SECRET = 'nexuva-admin-local-development-only-not-a-real-secret';

/** Below this a secret is short enough to be worth attacking directly. */
const MIN_SECRET_LENGTH = 32;

export function sessionSecret(): string {
  const configured = process.env['NEXTAUTH_SECRET']?.trim();

  if (configured) {
    // A weak secret is worth flagging, but not worth refusing to start over:
    // the hole being closed here is the published constant, and that is gone
    // the moment a real value is required.
    if (configured.length < MIN_SECRET_LENGTH) {
      console.warn(
        `NEXTAUTH_SECRET is only ${configured.length} characters. Use at least ` +
          `${MIN_SECRET_LENGTH}: openssl rand -base64 32`,
      );
    }
    return configured;
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'NEXTAUTH_SECRET is not set. Refusing to start with a guessable session key. ' +
        'Generate one with: openssl rand -base64 32',
    );
  }

  return DEVELOPMENT_ONLY_SECRET;
}

/**
 * Whether the session cookie carries the `__Secure-` prefix. NextAuth decides
 * this from the deployment URL, and the middleware has to agree with it or it
 * will look for a cookie that is not there.
 */
export function usesSecureCookie(): boolean {
  return process.env['NEXTAUTH_URL']?.startsWith('https://') ?? false;
}
