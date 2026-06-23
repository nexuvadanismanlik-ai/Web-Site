import { Injectable, type NestMiddleware, Logger } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { TenantService } from '../../modules/tenant/tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly tenantService: TenantService) {}

  async use(
    req: FastifyRequest & { tenantContext?: unknown },
    res: FastifyReply,
    next: () => void,
  ) {
    const host = req.headers.host ?? '';
    const domain = host.split(':')[0] ?? '';

    const result = await this.tenantService.resolveFromDomain(domain);

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
