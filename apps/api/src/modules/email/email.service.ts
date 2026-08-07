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

  // ─── Connection check ─────────────────────────────────────────────────────

  /**
   * Asks the provider whether the credentials work, without sending anything.
   *
   * The panel already had "send a test message", and that is the wrong first
   * question. A failed send has several possible causes — a wrong key, an
   * unverified sender domain, a rejected recipient, a provider outage — and
   * they need different fixes. Somebody typing an API key wants to know
   * immediately whether the key is right, and finding out by mailing themselves
   * makes their inbox part of the setup process.
   *
   * So this checks only the connection: SMTP opens a session and authenticates
   * and hangs up; the HTTP providers ask a read-only endpoint. A pass here plus
   * a failed send means the credentials are fine and the problem is the message
   * or the sender address, which is a far more useful place to start.
   */
  async verifyConnection(tenantId: string): Promise<{ ok: boolean; detail: string }> {
    const settings = await this.settings.resolve(tenantId);

    try {
      switch (settings.provider) {
        case 'smtp':
          return await this.verifySmtp(settings);
        case 'sendgrid':
          return await this.verifyHttp(
            settings.apiKey,
            'https://api.sendgrid.com/v3/scopes',
            'SendGrid',
          );
        default:
          return await this.verifyHttp(
            settings.apiKey,
            'https://api.resend.com/domains',
            'Resend',
          );
      }
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }

  private async verifySmtp(
    settings: ResolvedMailSettings,
  ): Promise<{ ok: boolean; detail: string }> {
    if (!settings.smtpHost) {
      return { ok: false, detail: 'SMTP sunucu adresi girilmemiş.' };
    }

    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure || settings.smtpPort === 465,
      ...(settings.smtpUser
        ? { auth: { user: settings.smtpUser, pass: settings.smtpPassword ?? '' } }
        : {}),
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
    });

    try {
      // Opens the session, negotiates TLS and authenticates, then closes.
      await transport.verify();
      return {
        ok: true,
        detail: `${settings.smtpHost}:${settings.smtpPort} bağlantısı kuruldu ve kimlik doğrulandı.`,
      };
    } catch (err) {
      return { ok: false, detail: explainSmtp(err as Error, settings) };
    } finally {
      transport.close();
    }
  }

  private async verifyHttp(
    apiKey: string | null | undefined,
    url: string,
    label: string,
  ): Promise<{ ok: boolean; detail: string }> {
    if (!apiKey) {
      return { ok: false, detail: `${label} API anahtarı girilmemiş.` };
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      return { ok: true, detail: `${label} anahtarı geçerli.` };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, detail: `${label} anahtarı reddedildi. Anahtarı yeniden oluşturup gir.` };
    }
    const body = await res.text().catch(() => '');
    return { ok: false, detail: `${label} ${res.status}: ${body.slice(0, 200) || 'ayrıntı yok'}` };
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

/**
 * Turns an SMTP failure into something a person can act on.
 *
 * Node's networking errors are accurate and useless: "ECONNREFUSED" does not
 * tell somebody that their provider wants port 587 rather than 465, and
 * "EAUTH" does not tell a Gmail user that their account password will never
 * work and they need an app password. Each of these is a mistake people make
 * once and then spend an hour on.
 */
function explainSmtp(err: Error, settings: { smtpHost?: string | null; smtpPort: number }): string {
  const raw = `${(err as Error & { code?: string }).code ?? ''} ${err.message}`;

  if (/EAUTH|535|Username and Password not accepted/i.test(raw)) {
    return (
      'Kullanıcı adı veya şifre reddedildi. Gmail ve Microsoft hesaplarında normal ' +
      'hesap şifresi çalışmaz — uygulama şifresi (app password) oluşturman gerekir.'
    );
  }
  if (/ECONNREFUSED/i.test(raw)) {
    return `${settings.smtpHost}:${settings.smtpPort} bağlantıyı reddetti. Port numarası yanlış olabilir — çoğu sağlayıcı 587 (STARTTLS) ya da 465 (SSL) kullanır.`;
  }
  if (/ETIMEDOUT|ESOCKET|timeout/i.test(raw)) {
    return `${settings.smtpHost}:${settings.smtpPort} yanıt vermedi. Sunucu adı yanlış olabilir ya da bu porta çıkış engellenmiş olabilir.`;
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(raw)) {
    return `"${settings.smtpHost}" adresi çözümlenemedi. Sunucu adında yazım hatası olabilir.`;
  }
  if (/self.signed|certificate|SSL|TLS/i.test(raw)) {
    return `TLS el sıkışması başarısız. Port ${settings.smtpPort} için güvenli bağlantı ayarı yanlış olabilir: 465 doğrudan SSL, 587 STARTTLS bekler.`;
  }
  return err.message;
}
