import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { verifySiteVersion } from '../website/publish/publish-verification';

/** What a connection is doing, in the three words an operator needs. */
export type ConnectionState = 'connected' | 'broken' | 'missing';

export interface ConnectionReport {
  /** Stable key the panel groups by. */
  key: string;

  /** Human-readable name shown in the panel. */
  label: string;

  /** Current connection state. */
  state: ConnectionState;

  /** Short explanation for an operator. */
  detail: string;

  /** Environment variables that can fix a missing configuration. */
  missing?: string[];
}

interface HttpResult {
  status: number;
  body: string;
}

/**
 * Platform readiness checks.
 *
 * This service intentionally performs real checks where possible instead of
 * assuming that an environment variable being present means the integration
 * actually works.
 */
@Injectable()
export class ReadinessService {
  private readonly logger = new Logger(ReadinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async report(): Promise<{
    connections: ConnectionReport[];
    checkedAt: string;
  }> {
    const connections = await Promise.all([
      this.database(),
      this.migrations(),
      Promise.resolve(this.storage()),
      Promise.resolve(this.deploy()),
      this.publishedSite(),
      this.email(),
      this.website(),
      this.domain(),
      this.certificate(),
      this.analytics(),
    ]);

    return {
      connections,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Real database query.
   */
  private async database(): Promise<ConnectionReport> {
    const started = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        key: 'database',
        label: 'Veritabanı (Supabase)',
        state: 'connected',
        detail: `Sorgu ${Date.now() - started} ms içinde döndü.`,
      };
    } catch (err) {
      return {
        key: 'database',
        label: 'Veritabanı (Supabase)',
        state: 'broken',
        detail:
          err instanceof Error
            ? err.message.split('\n')[0] || 'Bağlanılamadı'
            : 'Bağlanılamadı',
      };
    }
  }

  /**
   * Migration state, read from the database itself.
   *
   * On Vercel there is no start command to run migrations and report back, so
   * this asks Prisma's own bookkeeping table: how many migrations finished, and
   * whether any is stuck half-applied. A stuck one blocks every later
   * `prisma migrate deploy`, which is exactly what needs to be visible.
   */
  private async migrations(): Promise<ConnectionReport> {
    try {
      const rows = await this.prisma.$queryRaw<
        { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
      >`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;

      const applied = rows.filter((row) => row.finished_at !== null && row.rolled_back_at === null);
      const stuck = rows.filter((row) => row.finished_at === null && row.rolled_back_at === null);

      if (stuck.length > 0) {
        return {
          key: 'migrations',
          label: 'Veritabanı Şeması',
          state: 'broken',
          detail:
            `${applied.length} migration uygulanmış, ancak yarım kalmış kayıt var: ` +
            `${stuck.map((row) => row.migration_name).join(', ')}. ` +
            'Bu çözülmeden yeni migration uygulanamaz (DATABASE_MIGRATION.md).',
        };
      }

      return {
        key: 'migrations',
        label: 'Veritabanı Şeması',
        state: 'connected',
        detail: `${applied.length} migration uygulanmış; yarım kalmış kayıt yok.`,
      };
    } catch (err) {
      this.logger.warn(`Migration table probe failed: ${String(err)}`);
      return {
        key: 'migrations',
        label: 'Veritabanı Şeması',
        state: 'broken',
        detail: 'Migration kayıtları okunamadı.',
      };
    }
  }

  /**
   * Storage configuration.
   *
   * If R2 is not configured, the existing database-backed file storage
   * capability remains available.
   */
  private storage(): ConnectionReport {
    const required: Array<[string, string]> = [
      ['R2_ACCOUNT_ID', 'storage.accountId'],
      ['R2_ACCESS_KEY_ID', 'storage.accessKeyId'],
      ['R2_SECRET_ACCESS_KEY', 'storage.secretAccessKey'],
      ['R2_PUBLIC_URL', 'storage.publicUrl'],
    ];

    const missing: string[] = required
      .filter(([, key]) => {
        const value = this.config.get<string>(key);
        return !value;
      })
      .map(([name]) => name);

    if (missing.length > 0) {
      return {
        key: 'storage',
        label: 'Dosya Deposu (Veritabanı)',
        state: 'connected',
        detail:
          'Yükleme çalışıyor. Cloudflare R2 tanımlı olmadığı için dosyalar veritabanında saklanıyor ve API üzerinden sunuluyor. R2 değişkenleri tanımlanırsa nesne depolama kullanılabilir.',
        missing,
      };
    }

    return {
      key: 'storage',
      label: 'Dosya Deposu (Cloudflare R2)',
      state: 'connected',
      detail:
        'R2 yapılandırması mevcut. Dosyalar nesne depolama üzerinden sunulabilir.',
    };
  }

  /**
   * Publish strategy configuration.
   */
  private deploy(): ConnectionReport {
    const strategy = this.config.get<string>('publish.strategy') ?? 'none';
    const siteUrl = this.config.get<string>('publish.siteUrl') ?? '';

    if (strategy !== 'deploy-hook' && strategy !== 'revalidate') {
      return {
        key: 'deploy',
        label: 'Yayın',
        state: 'missing',
        detail:
          'Yayın stratejisi seçilmemiş. İçerik kaydedilebilir ancak siteye taşınamıyor.',
        missing: ['PUBLISH_STRATEGY'],
      };
    }

    const missing: string[] = [];
    if (strategy === 'revalidate') {
      if (!this.config.get<string>('publish.revalidateUrl')) missing.push('FRONTEND_REVALIDATE_URL');
      if (!this.config.get<string>('publish.revalidateSecret')) {
        missing.push('FRONTEND_REVALIDATE_SECRET');
      }
    } else if (!this.config.get<string>('publish.deployHookUrl')) {
      missing.push('DEPLOY_HOOK_URL');
    }
    // Without the site address a publish cannot be verified, and an unverified
    // publish is recorded as failed — so this is a missing setting, not a nicety.
    if (!siteUrl) missing.push('SITE_URL');

    const label = strategy === 'revalidate' ? 'Yayın (ISR revalidate)' : 'Yayın (deploy hook)';
    if (missing.length > 0) {
      return {
        key: 'deploy',
        label,
        state: 'missing',
        detail: 'Yayın stratejisi seçilmiş ancak gerekli ayarlar eksik.',
        missing,
      };
    }

    return {
      key: 'deploy',
      label,
      state: 'connected',
      detail:
        strategy === 'revalidate'
          ? 'Yayın sonrası site önbelleği yenilenir ve sitenin yeni sürümü sunduğu doğrulanır.'
          : 'Yayın sonrası derleme tetiklenir ve sitenin yeni sürümü sunduğu doğrulanır.',
    };
  }

  /**
   * Whether the live site serves the latest published content version.
   *
   * Replaces the Render API lookup: instead of asking a hosting provider about
   * its service, it asks the site what it is serving — which works on any host
   * and catches the failure that matters (visitors seeing old content).
   */
  private async publishedSite(): Promise<ConnectionReport> {
    const siteUrl = this.config.get<string>('publish.siteUrl') ?? '';
    if (!siteUrl) {
      return {
        key: 'hosting',
        label: 'Yayındaki site',
        state: 'missing',
        detail: 'Site adresi tanımlı olmadığı için sunulan içerik sürümü doğrulanamıyor.',
        missing: ['SITE_URL'],
      };
    }

    const latest = await this.prisma.contentVersion
      .findFirst({
        where: { isPublished: true },
        orderBy: { number: 'desc' },
        select: { number: true },
      })
      .catch(() => null);

    const outcome = await verifySiteVersion(siteUrl, latest?.number ?? 0, {
      attempts: 1,
      delayMs: 0,
      timeoutMs: 8_000,
    });

    if (outcome.status === 'unreachable') {
      return {
        key: 'hosting',
        label: 'Yayındaki site',
        state: 'broken',
        detail: `Siteye ulaşılamadı (${outcome.detail}).`,
      };
    }
    if (!latest) {
      return {
        key: 'hosting',
        label: 'Yayındaki site',
        state: 'connected',
        detail: 'Site erişilebilir; henüz yayınlanmış bir içerik sürümü yok.',
      };
    }
    if (outcome.status === 'verified') {
      return {
        key: 'hosting',
        label: 'Yayındaki site',
        state: 'connected',
        detail: `Site en son yayınlanan içeriği (sürüm ${outcome.served}) sunuyor.`,
      };
    }
    return {
      key: 'hosting',
      label: 'Yayındaki site',
      state: 'broken',
      detail:
        outcome.served === null
          ? `Site erişilebilir ama içerik sürümü bildirmiyor; en son yayınlanan sürüm ${latest.number}.`
          : `Site sürüm ${outcome.served}'i sunuyor, en son yayınlanan sürüm ${latest.number}.`,
    };
  }

  /**
   * Checks DNS resolution of the configured website address.
   */
  private async domain(): Promise<ConnectionReport> {
    const url =
      this.config.get<string>('publish.siteUrl') ?? '';

    if (!url) {
      return {
        key: 'domain',
        label: 'Alan Adı',
        state: 'missing',
        detail: 'Site adresi tanımlı değil.',
        missing: ['SITE_URL'],
      };
    }

    let host: string;

    try {
      host = new URL(url).hostname;
    } catch {
      return {
        key: 'domain',
        label: 'Alan Adı',
        state: 'broken',
        detail:
          `"${url}" geçerli bir adres değil.`,
      };
    }

    try {
      const { address } = await lookup(host);

      const isPlatformDefault =
        host.endsWith('.vercel.app');

      return {
        key: 'domain',
        label: 'Alan Adı',
        state: 'connected',
        detail: isPlatformDefault
          ? `${host} → ${address}. Vercel varsayılan alan adı kullanılıyor; kalıcı alan adı bağlanmamış.`
          : `${host} → ${address}. DNS çözümlemesi çalışıyor.`,
      };
    } catch {
      return {
        key: 'domain',
        label: 'Alan Adı',
        state: 'broken',
        detail:
          `${host} çözümlenemiyor. DNS kaydı eksik veya henüz yayılmamış olabilir.`,
      };
    }
  }

  /**
   * Reads the TLS certificate actually presented by the website.
   */
  private async certificate(): Promise<ConnectionReport> {
    const url =
      this.config.get<string>('publish.siteUrl') ?? '';

    if (!url) {
      return {
        key: 'ssl',
        label: 'SSL Sertifikası',
        state: 'missing',
        detail:
          'Site adresi tanımlı olmadığı için SSL sertifikası kontrol edilemiyor.',
        missing: ['SITE_URL'],
      };
    }

    let host: string;

    try {
      const parsed = new URL(url);

      if (parsed.protocol !== 'https:') {
        return {
          key: 'ssl',
          label: 'SSL Sertifikası',
          state: 'broken',
          detail:
            'Site adresi HTTPS kullanmıyor.',
        };
      }

      host = parsed.hostname;
    } catch {
      return {
        key: 'ssl',
        label: 'SSL Sertifikası',
        state: 'broken',
        detail: 'Site adresi okunamadı.',
      };
    }

    try {
      const cert = await readCertificate(host);

      if (!cert.validTo) {
        return {
          key: 'ssl',
          label: 'SSL Sertifikası',
          state: 'broken',
          detail:
            'Sunucunun SSL sertifikası okunamadı.',
        };
      }

      const daysLeft = Math.floor(
        (cert.validTo.getTime() - Date.now()) /
          86_400_000,
      );

      const expiry =
        cert.validTo.toLocaleDateString('tr-TR');

      if (daysLeft < 0) {
        return {
          key: 'ssl',
          label: 'SSL Sertifikası',
          state: 'broken',
          detail:
            `Sertifika ${expiry} tarihinde dolmuş.`,
        };
      }

      if (daysLeft < 14) {
        return {
          key: 'ssl',
          label: 'SSL Sertifikası',
          state: 'broken',
          detail:
            `Sertifikanın bitmesine ${daysLeft} gün kaldı (${expiry}).`,
        };
      }

      return {
        key: 'ssl',
        label: 'SSL Sertifikası',
        state: 'connected',
        detail:
          `Geçerli, ${expiry} tarihine kadar (${daysLeft} gün). Veren: ${cert.issuer || 'bilinmiyor'}.`,
      };
    } catch (err) {
      return {
        key: 'ssl',
        label: 'SSL Sertifikası',
        state: 'broken',
        detail:
          `Güvenli bağlantı kurulamadı: ${
            err instanceof Error
              ? err.message
              : 'bilinmeyen hata'
          }`,
      };
    }
  }

  /**
   * Checks whether analytics records are actually arriving.
   */
  private async analytics(): Promise<ConnectionReport> {
    try {
      const since = new Date(
        Date.now() - 7 * 86_400_000,
      );

      const recent =
        await this.prisma.pageView.count({
          where: {
            createdAt: {
              gte: since,
            },
          },
        });

      if (recent > 0) {
        return {
          key: 'analytics',
          label: 'Ziyaretçi Ölçümü',
          state: 'connected',
          detail:
            `Son 7 günde ${recent} sayfa görüntüleme kaydedildi.`,
        };
      }

      const total =
        await this.prisma.pageView.count();

      return {
        key: 'analytics',
        label: 'Ziyaretçi Ölçümü',
        state: 'missing',
        detail:
          total > 0
            ? 'Ölçüm kurulu ancak son 7 günde kayıt yok. Siteye ziyaret gelmemiş olabilir.'
            : 'Ölçüm için henüz veri gelmedi.',
      };
    } catch {
      return {
        key: 'analytics',
        label: 'Ziyaretçi Ölçümü',
        state: 'broken',
        detail:
          'Ziyaretçi kayıtları okunamadı.',
      };
    }
  }

  /**
   * Checks the configured email provider without sending an email.
   */
  private async email(): Promise<ConnectionReport> {
    const provider =
      this.config.get<string>('email.provider') ??
      'resend';

    const normalizedProvider =
      provider.toLowerCase();

    if (normalizedProvider === 'smtp') {
      return this.checkSmtp();
    }

    if (normalizedProvider === 'sendgrid') {
      return this.checkSendGrid();
    }

    return this.checkResend();
  }

  /**
   * Resend API check.
   */
  private async checkResend(): Promise<ConnectionReport> {
    const apiKey =
      this.config.get<string>(
        'email.resendApiKey',
      ) ?? '';

    if (!apiKey) {
      return {
        key: 'email',
        label: 'E-posta (resend)',
        state: 'missing',
        detail:
          'Resend API anahtarı tanımlı değil. Bildirim e-postaları gönderilemiyor.',
        missing: ['RESEND_API_KEY'],
      };
    }

    try {
      const result = await httpRequest(
        'https://api.resend.com/domains',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          timeoutMs: 10_000,
        },
      );

      if (
        result.status === 401 ||
        result.status === 403
      ) {
        return {
          key: 'email',
          label: 'E-posta (resend)',
          state: 'broken',
          detail:
            'Resend API anahtarı reddedildi.',
        };
      }

      if (
        result.status < 200 ||
        result.status >= 300
      ) {
        return {
          key: 'email',
          label: 'E-posta (resend)',
          state: 'broken',
          detail:
            `Resend HTTP ${result.status} döndürdü.`,
        };
      }

      return {
        key: 'email',
        label: 'E-posta (resend)',
        state: 'connected',
        detail:
          'Resend API anahtarı geçerli ve sağlayıcı yanıt veriyor.',
      };
    } catch {
      return {
        key: 'email',
        label: 'E-posta (resend)',
        state: 'broken',
        detail:
          'Resend sağlayıcısına ulaşılamadı.',
      };
    }
  }

  /**
   * SendGrid API check.
   */
  private async checkSendGrid(): Promise<ConnectionReport> {
    const apiKey =
      this.config.get<string>(
        'email.sendgridApiKey',
      ) ?? '';

    if (!apiKey) {
      return {
        key: 'email',
        label: 'E-posta (sendgrid)',
        state: 'missing',
        detail:
          'SendGrid API anahtarı tanımlı değil.',
        missing: ['SENDGRID_API_KEY'],
      };
    }

    try {
      const result = await httpRequest(
        'https://api.sendgrid.com/v3/scopes',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          timeoutMs: 10_000,
        },
      );

      if (
        result.status < 200 ||
        result.status >= 300
      ) {
        return {
          key: 'email',
          label: 'E-posta (sendgrid)',
          state: 'broken',
          detail:
            `SendGrid HTTP ${result.status} döndürdü.`,
        };
      }

      return {
        key: 'email',
        label: 'E-posta (sendgrid)',
        state: 'connected',
        detail:
          'SendGrid API anahtarı geçerli ve sağlayıcı yanıt veriyor.',
      };
    } catch {
      return {
        key: 'email',
        label: 'E-posta (sendgrid)',
        state: 'broken',
        detail:
          'SendGrid sağlayıcısına ulaşılamadı.',
      };
    }
  }

  /**
   * SMTP connectivity check.
   */
  private async checkSmtp(): Promise<ConnectionReport> {
    const host =
      this.config.get<string>(
        'email.smtp.host',
      ) ?? '';

    const port =
      this.config.get<number>(
        'email.smtp.port',
      ) ?? 587;

    if (!host) {
      return {
        key: 'email',
        label: 'E-posta (smtp)',
        state: 'missing',
        detail:
          'SMTP sunucu adresi tanımlı değil.',
        missing: ['SMTP_HOST'],
      };
    }

    const reachable = await canConnect(
      host,
      port,
      8_000,
    );

    if (!reachable) {
      return {
        key: 'email',
        label: 'E-posta (smtp)',
        state: 'broken',
        detail:
          `${host}:${port} bağlantıyı kabul etmiyor.`,
      };
    }

    return {
      key: 'email',
      label: 'E-posta (smtp)',
      state: 'connected',
      detail:
        `${host}:${port} bağlantıyı kabul ediyor.`,
    };
  }

  /**
   * Checks whether the actual website responds.
   */
  private async website(): Promise<ConnectionReport> {
    const url =
      this.config.get<string>('publish.siteUrl') ?? '';

    if (!url) {
      return {
        key: 'website',
        label: 'Web Sitesi',
        state: 'missing',
        detail:
          'Site adresi tanımlı değil.',
        missing: ['SITE_URL'],
      };
    }

    try {
      const result = await httpRequest(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'text/html,application/xhtml+xml',
          },
          timeoutMs: 8_000,
        },
      );

      if (
        result.status >= 200 &&
        result.status < 400
      ) {
        return {
          key: 'website',
          label: 'Web Sitesi',
          state: 'connected',
          detail:
            `${url} HTTP ${result.status} yanıtı veriyor.`,
        };
      }

      return {
        key: 'website',
        label: 'Web Sitesi',
        state: 'broken',
        detail:
          `${url} → HTTP ${result.status}. Site beklenen başarılı yanıtı vermiyor.`,
      };
    } catch (err) {
      this.logger.warn(
        `Website probe failed: ${String(err)}`,
      );

      return {
        key: 'website',
        label: 'Web Sitesi',
        state: 'broken',
        detail:
          `${url} adresine ulaşılamıyor.`,
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Performs an HTTP/HTTPS request using Node's native modules.
 *
 * We intentionally do not use the global fetch() here.
 * This keeps the service compatible with the project's current Node/TypeScript
 * setup and avoids the Response type conflict that previously broke the Vercel
 * build.
 */
async function httpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {},
): Promise<HttpResult> {
  const parsed = new URL(url);

  const method =
    options.method ?? 'GET';

  const headers =
    options.headers ?? {};

  const timeoutMs =
    options.timeoutMs ?? 10_000;

  if (
    parsed.protocol !== 'http:' &&
    parsed.protocol !== 'https:'
  ) {
    throw new Error(
      `Desteklenmeyen protokol: ${parsed.protocol}`,
    );
  }

  const requestOptions = {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port:
      parsed.port ||
      (parsed.protocol === 'https:' ? '443' : '80'),
    path:
      `${parsed.pathname}${parsed.search}`,
    method,
    headers,
  };

  if (parsed.protocol === 'https:') {
    const https =
      await import('node:https');

    return new Promise<HttpResult>(
      (resolve, reject) => {
        const request =
          https.request(
            requestOptions,
            (response) => {
              const chunks: Buffer[] = [];

              response.on(
                'data',
                (chunk: Buffer | string) => {
                  chunks.push(
                    Buffer.isBuffer(chunk)
                      ? chunk
                      : Buffer.from(chunk),
                  );
                },
              );

              response.on(
                'end',
                () => {
                  resolve({
                    status:
                      response.statusCode ?? 0,
                    body:
                      Buffer.concat(
                        chunks,
                      ).toString('utf8'),
                  });
                },
              );

              response.on(
                'error',
                reject,
              );
            },
          );

        request.setTimeout(
          timeoutMs,
          () => {
            request.destroy(
              new Error(
                'HTTP isteği zaman aşımına uğradı.',
              ),
            );
          },
        );

        request.on(
          'error',
          reject,
        );

        request.end();
      },
    );
  }

  const http =
    await import('node:http');

  return new Promise<HttpResult>(
    (resolve, reject) => {
      const request =
        http.request(
          requestOptions,
          (response) => {
            const chunks: Buffer[] = [];

            response.on(
              'data',
              (chunk: Buffer | string) => {
                chunks.push(
                  Buffer.isBuffer(chunk)
                    ? chunk
                    : Buffer.from(chunk),
                );
              },
            );

            response.on(
              'end',
              () => {
                resolve({
                  status:
                    response.statusCode ?? 0,
                  body:
                    Buffer.concat(
                      chunks,
                    ).toString('utf8'),
                });
              },
            );

            response.on(
              'error',
              reject,
            );
          },
        );

      request.setTimeout(
        timeoutMs,
        () => {
          request.destroy(
            new Error(
              'HTTP isteği zaman aşımına uğradı.',
            ),
          );
        },
      );

      request.on(
        'error',
        reject,
      );

      request.end();
    },
  );
}

/**
 * Resolves a hostname.
 */
async function lookup(
  host: string,
): Promise<{ address: string }> {
  const { promises } =
    await import('node:dns');

  const result =
    await promises.lookup(host);

  return {
    address: result.address,
  };
}

/**
 * Reads the TLS certificate presented by a host.
 */
async function readCertificate(
  host: string,
): Promise<{
  validTo: Date | null;
  issuer: string;
}> {
  const tls =
    await import('node:tls');

  return new Promise(
    (resolve, reject) => {
      const socket =
        tls.connect(
          {
            host,
            port: 443,
            servername: host,
            timeout: 10_000,
          },
          () => {
            const cert =
              socket.getPeerCertificate();

            socket.end();

            if (
              !cert ||
              Object.keys(cert).length === 0
            ) {
              resolve({
                validTo: null,
                issuer: '',
              });

              return;
            }

            const validTo =
              cert.valid_to
                ? new Date(cert.valid_to)
                : null;

            resolve({
              validTo:
                validTo &&
                !Number.isNaN(
                  validTo.getTime(),
                )
                  ? validTo
                  : null,

              issuer:
                firstOf(cert.issuer?.O) ||
                firstOf(cert.issuer?.CN),
            });
          },
        );

      socket.on(
        'error',
        (err) => {
          socket.destroy();
          reject(err);
        },
      );

      socket.on(
        'timeout',
        () => {
          socket.destroy();

          reject(
            new Error(
              'TLS bağlantısı zaman aşımına uğradı.',
            ),
          );
        },
      );
    },
  );
}

/**
 * Checks whether a TCP port accepts connections.
 */
async function canConnect(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<boolean> {
  const net =
    await import('node:net');

  return new Promise(
    (resolve) => {
      const socket =
        net.createConnection({
          host,
          port,
        });

      let settled = false;

      const done = (
        ok: boolean,
      ) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.destroy();
        resolve(ok);
      };

      socket.setTimeout(
        timeoutMs,
      );

      socket.on(
        'connect',
        () => done(true),
      );

      socket.on(
        'error',
        () => done(false),
      );

      socket.on(
        'timeout',
        () => done(false),
      );
    },
  );
}

/**
 * Certificate fields may be a string or an array.
 */
function firstOf(
  value:
    | string
    | string[]
    | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
}
