import { registerAs } from '@nestjs/config';

/**
 * How many reverse-proxy hops to trust in X-Forwarded-For.
 *
 * Render terminates TLS and proxies to the app, so without this every request
 * arrives carrying the proxy's own address: `req.ip` is identical for every
 * visitor, and both the global limiter and the contact form's per-IP cap
 * collapse into a single shared bucket. The form then locks itself after five
 * submissions an hour across the whole site.
 *
 * Trusting exactly one hop reads the entry the proxy appended rather than
 * anything the client sent, so a visitor cannot forge an address by supplying
 * their own X-Forwarded-For header. Off by default outside production, where
 * there is no proxy and the header would be attacker-controlled.
 */
export function resolveTrustProxy(raw: string | undefined, nodeEnv: string): boolean | number {
  if (raw === undefined || raw === '') return nodeEnv === 'production' ? 1 : false;
  if (raw === 'false') return false;
  if (raw === 'true') return true;
  const hops = Number.parseInt(raw, 10);
  return Number.isFinite(hops) && hops > 0 ? hops : false;
}

/** The four environments the platform runs in. */
export const APP_ENVIRONMENTS = ['local', 'development', 'staging', 'production'] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

/**
 * Which deployment this process is.
 *
 * Separate from NODE_ENV, which only distinguishes "built" from "not built" and
 * is `production` on a developer's machine the moment they run a build. This
 * names the environment the data belongs to, which is the question that matters
 * before writing to a database.
 */
export function resolveAppEnv(raw: string | undefined): AppEnvironment {
  const value = (raw ?? '').trim().toLowerCase();
  return (APP_ENVIRONMENTS as readonly string[]).includes(value)
    ? (value as AppEnvironment)
    : 'local';
}

/** The database host, for logging. Never the credentials. */
export function databaseHost(url: string | undefined): string {
  if (!url) return '(tanımsız)';
  try {
    return new URL(url).host;
  } catch {
    return '(okunamadı)';
  }
}

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? process.env.API_PORT ?? '4000', 10),
  prefix: process.env.API_PREFIX ?? 'api/v1',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001',
  // Tenant whose website content is served when a request does not name one.
  // Single-site deployments never need to pass a tenant.
  websiteTenantSlug: process.env.WEBSITE_TENANT_SLUG ?? 'nexuva',
  trustProxy: resolveTrustProxy(process.env.TRUST_PROXY, process.env.NODE_ENV ?? 'development'),
  env: resolveAppEnv(process.env.APP_ENV),
}));
