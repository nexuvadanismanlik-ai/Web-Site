import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailSettingsService, type ResolvedMailSettings } from './mail-settings.service';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  /** Recorded on the delivery log, so a failure can be traced to a template. */
  templateKey?: string;
  /** Whose configuration to send with. */
  tenantId: string;
}

export interface SendOutcome {
  ok: boolean;
  provider: string;
  detail: string;
}

/**
 * Sends mail, and remembers whether it worked.
 *
 * Two things were wrong before. SMTP and SendGrid threw "not implemented", so
 * choosing either meant silence — and SMTP is what Gmail, Microsoft and every
 * hosting provider offer, which is most of the ways a small company sends
 * mail. And nothing was written down: "did the customer get the
 * acknowledgement" had no answer, which is the question asked every time
 * somebody says they heard nothing back.
 *
 * Every attempt now goes through one path, ends in one log row, and reports a
 * provider's own words on failure rather than a paraphrase.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: MailSettingsService,
  ) {}

  async send(params: SendEmailParams): Promise<SendOutcome> {
    const settings = await this.settings.resolve(params.tenantId);
    const to = Array.isArray(params.to) ? params.to : [params.to];
    const from = params.from ?? formatFrom(settings);

    if (!settings.fromEmail) {
      return this.record(params, to, settings.provider, false, 'Gönderen adresi tanımlı değil.');
    }

    try {
      switch (settings.provider) {
        case 'smtp':
          await this.viaSmtp(settings, { ...params, to, from });
          break;
        case 'sendgrid':
          await this.viaSendGrid(settings, { ...params, to, from });
          break;
        default:
          await this.viaResend(settings, { ...params, to, from });
      }
      return this.record(params, to, settings.provider, true, 'Gönderildi.');
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Mail gönderilemedi (${settings.provider}) → ${to.join(', ')}: ${detail}`);
      return this.record(params, to, settings.provider, false, detail);
    }
  }

  /**
   * Sends and reports, without ever throwing.
   *
   * For paths where mail is a courtesy and the work must not fail with it —
   * an enquiry is saved whether or not its acknowledgement goes out.
   */
  async trySend(params: SendEmailParams): Promise<SendOutcome> {
    try {
      return await this.send(params);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Mail gönderiminde beklenmeyen hata: ${detail}`);
      return { ok: false, provider: 'unknown', detail };
    }
  }

  // ─── Providers ────────────────────────────────────────────────────────────

  private async viaResend(
    settings: ResolvedMailSettings,
    params: SendEmailParams & { to: string[]; from: string },
  ) {
    if (!settings.apiKey) throw new BadRequestException('Resend API anahtarı tanımlı değil.');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
        ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      // The provider's own message names the cause — an unverified domain, a
      // revoked key — and a status code alone does not.
      const body = await res.text().catch(() => '');
      throw new Error(`Resend ${res.status}: ${body.slice(0, 300) || 'ayrıntı yok'}`);
    }
  }

  private async viaSendGrid(
    settings: ResolvedMailSettings,
    params: SendEmailParams & { to: string[]; from: string },
  ) {
    if (!settings.apiKey) throw new BadRequestException('SendGrid API anahtarı tanımlı değil.');

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: params.to.map((email) => ({ email })) }],
        from: { email: settings.fromEmail, name: settings.fromName },
        ...(settings.replyTo ? { reply_to: { email: settings.replyTo } } : {}),
        subject: params.subject,
        content: [
          ...(params.text ? [{ type: 'text/plain', value: params.text }] : []),
          { type: 'text/html', value: params.html },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`SendGrid ${res.status}: ${body.slice(0, 300) || 'ayrıntı yok'}`);
    }
  }

  /**
   * Ordinary SMTP, which is also how Gmail and Microsoft are reached.
   *
   * Imported where it is used rather than at module load: nodemailer pulls in a
   * good deal of Node's networking surface, and an API that never sends mail
   * should not pay for it at boot.
   */
  private async viaSmtp(
    settings: ResolvedMailSettings,
    params: SendEmailParams & { to: string[]; from: string },
  ) {
    if (!settings.smtpHost) throw new BadRequestException('SMTP sunucusu tanımlı değil.');

    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      // Port 465 is implicit TLS; 587 upgrades with STARTTLS. Getting this
      // wrong is the most common reason a correct password still fails.
      secure: settings.smtpSecure || settings.smtpPort === 465,
      ...(settings.smtpUser
        ? { auth: { user: settings.smtpUser, pass: settings.smtpPassword ?? '' } }
        : {}),
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
    });

    await transport.sendMail({
      from: params.from,
      to: params.to.join(', '),
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
      ...(settings.replyTo ? { replyTo: settings.replyTo } : {}),
    });
  }

  // ─── Delivery log ─────────────────────────────────────────────────────────

  private async record(
    params: SendEmailParams,
    to: string[],
    provider: string,
    ok: boolean,
    detail: string,
  ): Promise<SendOutcome> {
    try {
      await this.prisma.mailLog.create({
        data: {
          tenantId: params.tenantId,
          to: to.join(', '),
          subject: params.subject,
          templateKey: params.templateKey ?? null,
          provider,
          status: ok ? 'SENT' : 'FAILED',
          error: ok ? null : detail.slice(0, 1000),
        },
      });
    } catch (err) {
      // A log that cannot be written must not turn a delivered mail into a
      // failure. It is still worth shouting about.
      this.logger.error(`Mail kaydı yazılamadı: ${String(err)}`);
    }
    return { ok, provider, detail };
  }
}

/** "Nexuva <noreply@nexuva.com>" — the form every provider accepts. */
export function formatFrom(settings: {
  fromName: string;
  fromEmail: string;
}): string {
  return settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
}
