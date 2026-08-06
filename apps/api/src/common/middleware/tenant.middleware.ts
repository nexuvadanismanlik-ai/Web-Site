import { Injectable, type NestMiddleware, Logger } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { TenantService } from '../../modules/tenant/tenant.service';

/**
 * Paths that must answer without touching the database.
 *
 * The health check is what the hosting platform uses to decide whether this
 * instance is alive. Resolving a tenant means a query, so while the database
 * was unreachable the health check failed too — the platform concluded the
 * process was broken and served 502 for everything, including the endpoints
 * that would have worked. A liveness probe that depends on the database is not
 * a liveness probe.
 */
const NO_TENANT_PREFIXES = ['/health', '/docs'];

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly tenantService: TenantService) {}

  async use(
    req: FastifyRequest & { tenantContext?: unknown },
    res: FastifyReply,
    next: () => void,
  ) {
    const path = (req.url ?? '').split('?')[0] ?? '';
    if (NO_TENANT_PREFIXES.some((prefix) => path.includes(prefix))) {
      req.tenantContext = null;
      next();
      return;
    }

    const host = req.headers.host ?? '';
    const domain = host.split(':')[0] ?? '';

    let result: Awaited<ReturnType<TenantService['resolveFromDomain']>>;
    try {
      result = await this.tenantService.resolveFromDomain(domain);
    } catch (err) {
      // A failed lookup used to escape into the exception filter and end the
      // request before any handler ran. Most routes name their tenant by slug
      // and never needed this; the ones that do will fail on their own terms,
      // with a message about what they were doing.
      this.logger.error(`Tenant çözümlenemedi (${domain}): ${String(err)}`);
      req.tenantContext = null;
      next();
      return;
    }

    if (!result.found || !result.context) {
      this.logger.warn(`Unresolved tenant for domain: ${domain}`);
      // Do not throw — let downstream handlers decide how to respond.
      // API routes return null context; public web routes can 404 themselves.
      req.tenantContext = null;
      next();
      return;
    }

    // Handle redirect domains: if the resolved domain is a REDIRECT type,
    // the TenantService returns the redirect target in context.redirectTo.
    const ctx = result.context as { redirectTo?: string };
    if (ctx.redirectTo) {
      await res.redirect(ctx.redirectTo, 301);
      return;
    }

    req.tenantContext = result.context;
    next();
  }
}
