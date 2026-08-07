import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';

/**
 * Settings that change how the panel reads its own data, rather than what the
 * website says.
 *
 * Kept apart from content on purpose: content is drafted, versioned and
 * published, and none of that makes sense for a preference. Changing the
 * timezone should take effect on the next report, not on the next deploy.
 *
 * Stored in the existing system_settings table, so this needed no migration —
 * a key/value row per tenant is exactly what that table is for.
 */

export interface SitePreferences {
  /**
   * The business's own timezone, as an IANA name.
   *
   * This is not cosmetic. Traffic is bucketed into days in the database, and
   * without a timezone that bucketing happens in UTC — so for a company in
   * UTC+3, "Bugün" on the analytics screen silently begins at three in the
   * morning and the last three hours of every evening land on tomorrow.
   */
  timezone: string;
}

const KEY = 'site.preferences';

export const DEFAULT_PREFERENCES: SitePreferences = {
  timezone: 'Europe/Istanbul',
};

/**
 * Timezones offered by the panel.
 *
 * A short list rather than all six hundred IANA names: this is a Turkish
 * business, and a searchable list of every zone on earth is a worse answer to
 * "which one am I in" than five plausible ones.
 */
export const OFFERED_TIMEZONES = [
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'Asia/Dubai',
  'UTC',
] as const;

@Injectable()
export class SitePreferencesService {
  private readonly logger = new Logger(SitePreferencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: WebsiteTenantService,
  ) {}

  async get(tenantSlug?: string): Promise<SitePreferences> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    return this.getForTenant(tenantId);
  }

  /**
   * Reads the preferences for a tenant id.
   *
   * Falls back to the defaults rather than throwing: a report should not fail
   * because nobody has visited the settings screen yet.
   */
  async getForTenant(tenantId: string): Promise<SitePreferences> {
    try {
      const row = await this.prisma.systemSetting.findFirst({
        where: { key: KEY, tenantId, deletedAt: null },
        select: { value: true },
      });
      const stored = (row?.value ?? {}) as Partial<SitePreferences>;
      return {
        timezone: isKnownTimezone(stored.timezone)
          ? stored.timezone
          : DEFAULT_PREFERENCES.timezone,
      };
    } catch (err) {
      this.logger.warn(`Tercihler okunamadı, varsayılan kullanılıyor: ${(err as Error).message}`);
      return DEFAULT_PREFERENCES;
    }
  }

  async save(input: Partial<SitePreferences>, tenantSlug?: string): Promise<SitePreferences> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);

    if (input.timezone !== undefined && !isKnownTimezone(input.timezone)) {
      throw new BadRequestException(
        `Tanınmayan zaman dilimi: "${input.timezone}". Seçenekler: ${OFFERED_TIMEZONES.join(', ')}`,
      );
    }

    const current = await this.getForTenant(tenantId);
    const next: SitePreferences = {
      timezone: input.timezone ?? current.timezone,
    };

    await this.prisma.systemSetting.upsert({
      where: { key_tenantId: { key: KEY, tenantId } },
      create: {
        key: KEY,
        tenantId,
        value: next as unknown as object,
        type: 'JSON',
        description: 'Panel tercihleri: zaman dilimi',
      },
      update: { value: next as unknown as object, deletedAt: null },
    });

    return next;
  }
}

function isKnownTimezone(value: unknown): value is string {
  return typeof value === 'string' && (OFFERED_TIMEZONES as readonly string[]).includes(value);
}
