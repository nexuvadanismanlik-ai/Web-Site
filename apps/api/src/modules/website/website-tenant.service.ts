import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolves which tenant's website is being addressed.
 *
 * The public site is statically exported and has no tenant context of its own,
 * so requests either name a tenant explicitly (`?tenant=slug`) or fall back to
 * WEBSITE_TENANT_SLUG. Keeping this indirection here means the CMS is already
 * multi-site ready for Nexuva Core without complicating today's single site.
 */
@Injectable()
export class WebsiteTenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolveTenantId(slug?: string): Promise<string> {
    const target =
      slug?.trim() || this.config.get<string>('app.websiteTenantSlug', 'nexuva');

    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: target, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Website tenant "${target}" not found`);
    }
    return tenant.id;
  }
}
