import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/** What the panel may set, and what the sender needs. */
export interface ResolvedMailSettings {
  provider: 'resend' | 'smtp' | 'sendgrid';
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  /** Addresses that hear about a new enquiry. */
  notifyTo: string[];
  apiKey: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpSecure: boolean;
  /** True when the values came from the database rather than the environment. */
  fromDatabase: boolean;
}

/**
 * Where mail configuration comes from.
 *
 * The database first, because that is what the panel writes and the person who
 * needs to change a sender address is the person using the panel. Environment
 * variables remain a fallback so a deployment that was working before this
 * existed keeps working, and so a fresh install can be seeded from its host.
 */
@Injectable()
export class MailSettingsService {
  private readonly logger = new Logger(MailSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolve(tenantId: string): Promise<ResolvedMailSettings> {
    const stored = await this.prisma.mailSettings
      .findUnique({ where: { tenantId } })
      .catch(() => null);

    if (stored) {
      const provider =
        stored.provider === 'smtp' || stored.provider === 'sendgrid' ? stored.provider : 'resend';
      return {
        provider,
        fromEmail: stored.fromEmail,
        fromName: stored.fromName,
        replyTo: stored.replyTo,
        notifyTo: splitAddresses(stored.notifyTo),
        apiKey: stored.apiKey,
        smtpHost: stored.smtpHost,
        smtpPort: stored.smtpPort ?? 587,
        smtpUser: stored.smtpUser,
        smtpPassword: stored.smtpPassword,
        smtpSecure: stored.smtpSecure,
        fromDatabase: true,
      };
    }

    const envProvider = this.config.get<string>('email.provider') ?? 'resend';
    return {
      provider: envProvider === 'smtp' || envProvider === 'sendgrid' ? envProvider : 'resend',
      fromEmail: this.config.get<string>('email.from') ?? '',
      fromName: this.config.get<string>('email.fromName') ?? 'Nexuva',
      replyTo: null,
      notifyTo: this.config.get<string[]>('email.contactNotifyTo') ?? [],
      apiKey:
        envProvider === 'sendgrid'
          ? (this.config.get<string>('email.sendgridApiKey') ?? null)
          : (this.config.get<string>('email.resendApiKey') ?? null),
      smtpHost: this.config.get<string>('email.smtp.host') ?? null,
      smtpPort: this.config.get<number>('email.smtp.port') ?? 587,
      smtpUser: this.config.get<string>('email.smtp.user') ?? null,
      smtpPassword: this.config.get<string>('email.smtp.pass') ?? null,
      smtpSecure: this.config.get<boolean>('email.smtp.secure') ?? false,
      fromDatabase: false,
    };
  }

  /**
   * What the panel is allowed to see.
   *
   * Secrets go in and never come back: a field that returns the password it
   * was given turns every screen that displays it into a way to read it. The
   * panel is told whether one is set, which is the only thing it needs.
   */
  async readForPanel(tenantId: string) {
    const settings = await this.resolve(tenantId);
    return {
      provider: settings.provider,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      replyTo: settings.replyTo ?? '',
      notifyTo: settings.notifyTo.join(', '),
      hasApiKey: Boolean(settings.apiKey),
      smtpHost: settings.smtpHost ?? '',
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser ?? '',
      hasSmtpPassword: Boolean(settings.smtpPassword),
      smtpSecure: settings.smtpSecure,
      fromDatabase: settings.fromDatabase,
      ...(await this.lastTest(tenantId)),
    };
  }

  private async lastTest(tenantId: string) {
    const row = await this.prisma.mailSettings
      .findUnique({
        where: { tenantId },
        select: { lastTestAt: true, lastTestOk: true, lastTestMessage: true },
      })
      .catch(() => null);
    return {
      lastTestAt: row?.lastTestAt?.toISOString() ?? null,
      lastTestOk: row?.lastTestOk ?? null,
      lastTestMessage: row?.lastTestMessage ?? null,
    };
  }

  /**
   * Saves what the panel sent.
   *
   * A secret left empty means "keep the one you have", not "clear it" — the
   * panel cannot show the current value, so it cannot send it back, and
   * treating an empty box as a deletion would wipe the configuration every
   * time somebody changed the sender name.
   */
  async save(
    tenantId: string,
    input: {
      provider: string;
      fromEmail: string;
      fromName: string;
      replyTo?: string;
      notifyTo?: string;
      apiKey?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      smtpSecure?: boolean;
    },
  ) {
    const secrets: { apiKey?: string; smtpPassword?: string } = {};
    if (input.apiKey && input.apiKey.trim()) secrets.apiKey = input.apiKey.trim();
    if (input.smtpPassword && input.smtpPassword.trim()) {
      secrets.smtpPassword = input.smtpPassword.trim();
    }

    const shared = {
      provider: input.provider,
      fromEmail: input.fromEmail.trim(),
      fromName: input.fromName.trim(),
      replyTo: input.replyTo?.trim() || null,
      notifyTo: input.notifyTo?.trim() ?? '',
      smtpHost: input.smtpHost?.trim() || null,
      smtpPort: input.smtpPort ?? 587,
      smtpUser: input.smtpUser?.trim() || null,
      smtpSecure: input.smtpSecure ?? false,
      ...secrets,
    };

    await this.prisma.mailSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...shared },
      update: shared,
    });

    this.logger.log(`Mail settings saved for tenant ${tenantId} (${input.provider})`);
    return this.readForPanel(tenantId);
  }

  async recordTest(tenantId: string, ok: boolean, message: string) {
    await this.prisma.mailSettings
      .update({
        where: { tenantId },
        data: { lastTestAt: new Date(), lastTestOk: ok, lastTestMessage: message.slice(0, 500) },
      })
      .catch(() => {
        // No stored settings yet — the test ran against environment values and
        // there is no row to annotate. Not worth failing the test over.
      });
  }
}

/** Comma or semicolon separated, because both are what people type. */
export function splitAddresses(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((address) => address.trim())
    .filter(Boolean);
}
