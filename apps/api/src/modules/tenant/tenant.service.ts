import { Injectable, Logger } from '@nestjs/common';
import type { TenantContext, TenantResolutionResult } from '@nexuva/types';
import { PrismaService } from '../../prisma/prisma.service';

interface CacheEntry {
  context: TenantContext;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async resolveFromDomain(domain: string): Promise<TenantResolutionResult> {
    const cached = this.cache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return { found: true, context: cached.context };
    }

    const domainRecord = await this.prisma.domain.findFirst({
      where: { domainName: domain, isActive: true },
      include: {
        tenant: {
          include: {
            branding: true,
            featureFlags: { where: { tenantId: { not: null } } },
            domains: { where: { isActive: true, type: 'PRIMARY' } },
          },
        },
      },
    });

    if (!domainRecord) {
      this.logger.warn(`Domain not found: ${domain}`);
      return { found: false, context: null };
    }

    // REDIRECT domains: return a minimal context with redirectTo set.
    // The middleware will issue the 301 and stop further processing.
    if (domainRecord.type === 'REDIRECT') {
      if (!domainRecord.redirectTo) {
        this.logger.warn(`REDIRECT domain ${domain} has no redirectTo target`);
        return { found: false, context: null };
      }

      const redirectContext: TenantContext = {
        tenantId: domainRecord.tenant.id,
        slug: domainRecord.tenant.slug,
        type: domainRecord.tenant.type as TenantContext['type'],
        name: domainRecord.tenant.name,
        primaryDomain: domain,
        branding: null,
        locale: 'tr',
        featureFlags: {},
        redirectTo: domainRecord.redirectTo,
      };

      // Cache redirect resolutions too (short TTL would be fine but 60s is acceptable)
      this.cache.set(domain, { context: redirectContext, expiresAt: Date.now() + CACHE_TTL_MS });
      return { found: true, context: redirectContext };
    }

    const { tenant } = domainRecord;

    const globalFlags = await this.prisma.featureFlag.findMany({
      where: { tenantId: null },
    });

    const flagMap: Record<string, boolean> = {};
    for (const flag of globalFlags) {
      flagMap[flag.key] = flag.isEnabled;
    }
    for (const flag of tenant.featureFlags) {
      flagMap[flag.key] = flag.isEnabled;
    }

    // Derive locale from the primary domain's settings if available,
    // falling back to the tenant's default stored locale, then 'tr'.
    const locale = (tenant as unknown as { locale?: string }).locale ?? 'tr';

    const context: TenantContext = {
      tenantId: tenant.id,
      slug: tenant.slug,
      type: tenant.type as TenantContext['type'],
      name: tenant.name,
      primaryDomain: domain,
      branding: tenant.branding as TenantContext['branding'],
      locale,
      featureFlags: flagMap,
    };

    this.cache.set(domain, { context, expiresAt: Date.now() + CACHE_TTL_MS });
    return { found: true, context };
  }

  invalidateCache(domain?: string) {
    if (domain) {
      this.cache.delete(domain);
    } else {
      this.cache.clear();
    }
  }
}
