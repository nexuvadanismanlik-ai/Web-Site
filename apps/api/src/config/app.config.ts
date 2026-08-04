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

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? process.env.API_PORT ?? '4000', 10),
  prefix: process.env.API_PREFIX ?? 'api/v1',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001',
  // Tenant whose website content is served when a request does not name one.
  // Single-site deployments never need to pass a tenant.
  websiteTenantSlug: process.env.WEBSITE_TENANT_SLUG ?? 'nexuva',
  trustProxy: resolveTrustProxy(process.env.TRUST_PROXY, process.env.NODE_ENV ?? 'development'),
}));
