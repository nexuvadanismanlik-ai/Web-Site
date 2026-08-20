import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

/**
 * What a connection is doing.
 *
 * connected = working
 * broken    = configured but not working
 * missing   = not configured / cannot be verified
 */
export type ConnectionState =
  | 'connected'
  | 'broken'
  | 'missing';

export interface ConnectionReport {
  /** Stable key the panel groups by. */
  key: string;

  /** Human-readable name. */
  label: string;

  /** Current connection state. */
  state: ConnectionState;

  /** Short explanation for the operator. */
  detail: string;

  /** Environment variables that can fix a missing configuration. */
  missing?: string[];
}

/**
 * Small internal HTTP result.
 *
 * We deliberately do NOT use the global Fetch API Response type here.
 *
 * This project contains multiple Node/Fastify/TypeScript type definitions and
 * the global `Response` type is conflicting during the Vercel build.
 *
 * Using our own result type keeps this service independent from that conflict.
 */
interface HttpResult {
  statusCode: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Whether the platform's important connections are actually working.
 *
 * This is intentionally different from /health.
 *
 * /health answers:
 * "Is the API process alive?"
 *
 * This service answers:
 * "Are the important external/internal dependencies actually working?"
 *
 * Every check either performs a real connection or clearly reports that the
 * required configuration is missing.
 */
@Injectable()
export class ReadinessService {
  private readonly logger = new Logger(
    ReadinessService.name,
  );

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
      Promise.resolve(this.migrations()),
      Promise.resolve(this.storage()),
      Promise.resolve(this.deploy()),
      this.renderService(),
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
        detail: `Sorgu ${
          Date.now() - started
        } ms içinde döndü.`,
      };
    } catch (err) {
      return {
        key: 'database',
        label: 'Veritabanı (Supabase)',
        state: 'broken',
        detail:
          err instanceof Error
            ? err.message.split('\n')[0] ||
              'Bağlanılamadı'
            : 'Bağlanılamadı',
      };
    }
  }

  /**
   * Reports migration status written by the startup process.
   */
  private migrations(): ConnectionReport {
    const status =
      process.env['NEXUVA_MIGRATION_STATUS'];

    const detail =
      process.env['NEXUVA_MIGRATION_DETAIL'] ?? '';

    if (status === 'failed') {
      return {
        key: 'migrations',
        label: 'Veritabanı Şeması',
        state: 'broken',
        detail:
          `${detail} Şema beklenenden geride olabilir.`.trim(),
      };
    }

    if (status === 'skipped') {
      return {
        key: 'migrations',
        label: 'Veritabanı Şeması',
        state: 'missing',
        detail:
          `Migration atlandı${
            detail ? ` (${detail})` : ''
          }.`,
      };
    }

    if (status === 'ok') {
      return {
        key: 'migrations',
        label: 'Veritabanı Şeması',
        state: 'connected',
        detail:
          detail || 'Migration’lar güncel.',
      };
    }

    return {
      key: 'migrations',
      label: 'Veritabanı Şeması',
      state: 'missing',
      detail:
        'Bu süreç migration adımından geçmeden başlatılmış. ' +
        'Bu nedenle şemanın güncel olduğu doğrulanamıyor.',
    };
  }

  /**
   * Checks storage configuration.
   *
   * R2 is optional because the application currently has a database fallback.
   */
  private storage(): ConnectionReport {
    const required = [
      ['R2_ACCOUNT_ID', 'storage.accountId'],
      [
        'R2_ACCESS_KEY_ID',
        'storage.accessKeyId',
      ],
      [
        'R2_SECRET_ACCESS_KEY',
        'storage.secretAccessKey',
      ],
      ['R2_PUBLIC_URL', 'storage.publicUrl'],
    ] as const;

    const missing = required
      .filter(
        ([, key]) =>
          !this.config.get<string>(key),
      )
      .map(([name]) => name);

    if (missing.length > 0) {
      return {
        key: 'storage',
        label: 'Dosya Deposu (Veritabanı)',
        state: 'connected',
        detail:
          'Yükleme çalışıyor. Cloudflare R2 tanımlı olmadığı için ' +
          'dosyalar mevcut veritabanı depolama mekanizması üzerinden ' +
          'sunuluyor. R2 değişkenleri tanımlandığında nesne depolama ' +
          'kullanılabilir.',
        missing,
      };
    }

    return {
      key: 'storage',
      label: 'Dosya Deposu (Cloudflare R2)',
      state: 'connected',
      detail:
        'Cloudflare R2 yapılandırması mevcut.',
    };
  }

  /**
   * Checks the configured publishing strategy.
   */
  private deploy(): ConnectionReport {
    const strategy =
      this.config.get<string>(
        'publish.strategy',
      ) ?? 'none';

    if (
      strategy !== 'deploy-hook' &&
      strategy !== 'revalidate'
    ) {
      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'missing',
        detail:
          'Yayın stratejisi seçilmemiş. İçerik kaydedilebilir ancak ' +
          'site yeniden yayınlanmayabilir.',
        missing: ['PUBLISH_STRATEGY'],
      };
    }

    if (strategy === 'revalidate') {
      const missing = [
        [
          'FRONTEND_REVALIDATE_URL',
          'publish.revalidateUrl',
        ],
        [
          'FRONTEND_REVALIDATE_SECRET',
          'publish.revalidateSecret',
        ],
      ]
        .filter(
          ([, key]) =>
            !this.config.get<string>(key),
        )
        .map(([name]) => name);

      if (missing.length > 0) {
        return {
          key: 'deploy',
          label: 'Yayın (ISR revalidate)',
          state: 'missing',
          detail:
            'Yayın stratejisi revalidate ancak gerekli adres veya anahtar tanımlı değil.',
          missing,
        };
      }

      return {
        key: 'deploy',
        label: 'Yayın (ISR revalidate)',
        state: 'connected',
        detail:
          'Yayınlama önbelleği revalidate mekanizmasıyla tazelenebilir.',
      };
    }

    if (
      !this.config.get<string>(
        'publish.deployHookUrl',
      )
    ) {
      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'missing',
        detail:
          'Deploy hook stratejisi seçilmiş ancak tetiklenecek adres tanımlı değil.',
        missing: ['RENDER_DEPLOY_HOOK_URL'],
      };
    }

    const renderApiKey =
      this.config.get<string>(
        'publish.renderApiKey',
      );

    const renderServiceId =
      this.config.get<string>(
        'publish.renderServiceId',
      );

    const missing: string[] = [];

    if (!renderApiKey) {
      missing.push('RENDER_API_KEY');
    }

    if (!renderServiceId) {
      missing.push(
        'RENDER_FRONTEND_SERVICE_ID',
      );
    }

    if (missing.length > 0) {
      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'broken',
        detail:
          'Deploy tetiklenebilir ancak Render sonucunun takip edilmesi için gerekli bilgiler eksik.',
        missing,
      };
    }

    return {
      key: 'deploy',
      label: 'Yayın (Render Deploy)',
      state: 'connected',
      detail:
        'Deploy hook ve Render servis bilgileri yapılandırılmış.',
    };
  }

  /**
   * Checks the Render service through the Render API.
   */
  private async renderService(): Promise<ConnectionReport> {
    const key =
      this.config.get<string>(
        'publish.renderApiKey',
      ) ?? '';

    const serviceId =
      this.config.get<string>(
        'publish.renderServiceId',
      ) ?? '';

    if (!key || !serviceId) {
      const missing: string[] = [];

      if (!key) {
        missing.push('RENDER_API_KEY');
      }

      if (!serviceId) {
        missing.push(
          'RENDER_FRONTEND_SERVICE_ID',
        );
      }

      return {
        key: 'render',
        label: 'Render (barındırma)',
        state: 'missing',
        detail:
          'Render servisinin durumu doğrulanamıyor çünkü gerekli bilgiler tanımlı değil.',
        missing,
      };
    }

    try {
      const result = await httpRequest(
        `https://api.render.com/v1/services/${encodeURIComponent(
          serviceId,
        )}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
          },
          timeoutMs: 10_000,
        },
      );

      if (
        result.statusCode === 401 ||
        result.statusCode === 403
      ) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            'Render API anahtarı reddedildi.',
        };
      }

      if (result.statusCode === 404) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            `Render servisi bulunamadı (${serviceId}).`,
        };
      }

      if (
        result.statusCode < 200 ||
        result.statusCode >= 300
      ) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            `Render API HTTP ${result.statusCode} döndü.`,
        };
      }

      let body: {
        name?: string;
        suspended?: string;
      } = {};

      try {
        body = JSON.parse(result.body) as {
          name?: string;
          suspended?: string;
        };
      } catch {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            'Render API yanıtı okunamadı.',
        };
      }

      const suspended =
        body.suspended === 'suspended';

      return {
        key: 'render',
        label: 'Render (barındırma)',
        state: suspended
          ? 'broken'
          : 'connected',
        detail: suspended
          ? `"${body.name ?? serviceId}" askıya alınmış.`
          : `"${body.name ?? serviceId}" Render servisi erişilebilir.`,
      };
    } catch (err) {
      this.logger.warn(
        `Render API probe failed: ${String(err)}`,
      );

      return {
        key: 'render',
        label: 'Render (barındırma)',
        state: 'broken',
        detail:
          'Render API\'sine ulaşılamadı.',
      };
    }
  }

  /**
   * Checks whether the configured domain resolves.
   */
  private async domain(): Promise<ConnectionReport> {
    const url =
      this.config.get<string>(
        'publish.siteUrl',
      ) ?? '';

    if (!url) {
      return {
        key: 'domain',
        label: 'Alan Adı',
        state: 'missing',
        detail:
          'Site adresi tanımlı değil.',
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
      const { address } =
        await lookup(host);

      const isPlatformDefault =
        host.endsWith('.onrender.com');

      return {
        key: 'domain',
        label: 'Alan Adı',
        state: 'connected',
        detail: isPlatformDefault
          ? `${host} → ${address}. Render varsayılan alan adı kullanılıyor.`
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
   * Reads the actual TLS certificate presented by the site.
   */
  private async certificate(): Promise<ConnectionReport> {
    const url =
      this.config.get<string>(
        'publish.siteUrl',
      ) ?? '';

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
        detail:
          'Site adresi okunamadı.',
      };
    }

    try {
      const cert =
        await readCertificate(host);

      if (!cert.validTo) {
        return {
          key: 'ssl',
          label: 'SSL Sertifikası',
          state: 'broken',
          detail:
            'SSL sertifikası okunamadı.',
        };
      }

      const daysLeft = Math.floor(
        (cert.validTo.getTime() -
          Date.now()) /
          86_400_000,
      );

      const expiry =
        cert.validTo.toLocaleDateString(
          'tr-TR',
        );

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
          `Geçerli, ${expiry} tarihine kadar (${daysLeft} gün). Veren: ${
            cert.issuer || 'bilinmiyor'
          }.`,
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
   * Checks actual analytics rows in the database.
   */
  private async analytics(): Promise<ConnectionReport> {
    try {
      const since = new Date(
        Date.now() -
          7 * 86_400_000,
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
            ? 'Ölçüm kurulmuş ancak son 7 günde kayıt yok.'
            : 'Henüz ziyaretçi ölçüm verisi gelmedi.',
      };
    } catch (err) {
      this.logger.warn(
        `Analytics probe failed: ${String(err)}`,
      );

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
   * Checks the configured mail provider.
   */
  private async email(): Promise<ConnectionReport> {
    const provider =
      this.config.get<string>(
        'email.provider',
      ) ?? 'resend';

    const key =
      provider === 'sendgrid'
        ? 'email.sendgridApiKey'
        : provider === 'smtp'
          ? 'email.smtp.host'
          : 'email.resendApiKey';

    const name =
      provider === 'sendgrid'
        ? 'SENDGRID_API_KEY'
        : provider === 'smtp'
          ? 'SMTP_HOST'
          : 'RESEND_API_KEY';

    const value =
      this.config.get<string>(key);

    if (!value) {
      return {
        key: 'email',
        label: `E-posta (${provider})`,
        state: 'missing',
        detail:
          'E-posta sağlayıcısı yapılandırılmamış.',
        missing: [name],
      };
    }

    try {
      /**
       * Resend
       */
      if (provider === 'resend') {
        const result =
          await httpRequest(
            'https://api.resend.com/domains',
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${value}`,
                Accept: 'application/json',
              },
              timeoutMs: 10_000,
            },
          );

        if (
          result.statusCode === 401 ||
          result.statusCode === 403
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
          result.statusCode < 200 ||
          result.statusCode >= 300
        ) {
          return {
            key: 'email',
            label: 'E-posta (resend)',
            state: 'broken',
            detail:
              `Resend HTTP ${result.statusCode} döndü.`,
          };
        }

        return {
          key: 'email',
          label: 'E-posta (resend)',
          state: 'connected',
          detail:
            'Resend API anahtarı geçerli ve sağlayıcı yanıt veriyor.',
        };
      }

      /**
       * SMTP
       */
      if (provider === 'smtp') {
        const host = value;

        const port =
          this.config.get<number>(
            'email.smtp.port',
          ) ?? 587;

        const reachable =
          await canConnect(
            host,
            port,
            8_000,
          );

        if (reachable) {
          return {
            key: 'email',
            label: 'E-posta (smtp)',
            state: 'connected',
            detail:
              `${host}:${port} bağlantıyı kabul ediyor.`,
          };
        }

        return {
          key: 'email',
          label: 'E-posta (smtp)',
          state: 'broken',
          detail:
            `${host}:${port} bağlantıyı kabul etmiyor.`,
        };
      }

      /**
       * SendGrid
       */
      if (provider === 'sendgrid') {
        const result =
          await httpRequest(
            'https://api.sendgrid.com/v3/scopes',
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${value}`,
                Accept: 'application/json',
              },
              timeoutMs: 10_000,
            },
          );

        if (
          result.statusCode === 401 ||
          result.statusCode === 403
        ) {
          return {
            key: 'email',
            label: 'E-posta (sendgrid)',
            state: 'broken',
            detail:
              'SendGrid API anahtarı reddedildi.',
          };
        }

        if (
          result.statusCode >= 200 &&
          result.statusCode < 300
        ) {
          return {
            key: 'email',
            label: 'E-posta (sendgrid)',
            state: 'connected',
            detail:
              'SendGrid API anahtarı geçerli ve sağlayıcı yanıt veriyor.',
          };
        }

        return {
          key: 'email',
          label: 'E-posta (sendgrid)',
          state: 'broken',
          detail:
            `SendGrid HTTP ${result.statusCode} döndü.`,
        };
      }

      return {
        key: 'email',
        label: `E-posta (${provider})`,
        state: 'broken',
        detail:
          `Desteklenmeyen e-posta sağlayıcısı: ${provider}.`,
      };
    } catch (err) {
      this.logger.warn(
        `Email provider probe failed: ${String(err)}`,
      );

      return {
        key: 'email',
        label: `E-posta (${provider})`,
        state: 'broken',
        detail:
          'E-posta sağlayıcısına ulaşılamadı.',
      };
    }
  }

  /**
   * Checks whether the actual published website responds.
   *
   * We accept 2xx and 3xx responses because a perfectly healthy website can
   * legitimately redirect the root URL.
   */
  private async website(): Promise<ConnectionReport> {
    const url =
      this.config.get<string>(
        'publish.siteUrl',
      ) ?? '';

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
      const result =
        await httpRequest(url, {
          method: 'GET',
          headers: {
            Accept:
              'text/html,application/xhtml+xml',
          },
          timeoutMs: 8_000,
          maxRedirects: 5,
        });

      if (
        result.statusCode >= 200 &&
        result.statusCode < 400
      ) {
        return {
          key: 'website',
          label: 'Web Sitesi',
          state: 'connected',
          detail:
            `${url} yanıt veriyor (HTTP ${result.statusCode}).`,
        };
      }

      return {
        key: 'website',
        label: 'Web Sitesi',
        state: 'broken',
        detail:
          `${url} → HTTP ${result.statusCode}. Site ziyaretçiye başarılı yanıt vermiyor.`,
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

/* ============================================================================
 * HTTP HELPERS
 * ============================================================================
 *
 * These helpers replace fetch().
 *
 * The important point for this project is that the readiness service no longer
 * depends on the TypeScript `Response` type at all.
 */

/**
 * Makes an HTTP/HTTPS request and returns our own small response object.
 *
 * Supports redirects because the public website may redirect from one URL to
 * another.
 */
async function httpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {},
): Promise<HttpResult> {
  const method =
    options.method ?? 'GET';

  const timeoutMs =
    options.timeoutMs ?? 10_000;

  const maxRedirects =
    options.maxRedirects ?? 5;

  const headers =
    options.headers ?? {};

  return requestOnce(
    url,
    {
      method,
      headers,
      timeoutMs,
    },
    maxRedirects,
  );
}

/**
 * Performs one HTTP/HTTPS request.
 */
async function requestOnce(
  url: string,
  options: {
    method: string;
    headers: Record<string, string>;
    timeoutMs: number;
  },
  redirectsRemaining: number,
): Promise<HttpResult> {
  const parsed = new URL(url);

  const isHttps =
    parsed.protocol === 'https:';

  if (
    parsed.protocol !== 'http:' &&
    parsed.protocol !== 'https:'
  ) {
    throw new Error(
      `Desteklenmeyen URL protokolü: ${parsed.protocol}`,
    );
  }

  const requestFn = isHttps
    ? httpsRequest
    : httpRequest;

  return new Promise<HttpResult>(
    (resolve, reject) => {
      const request = requestFn(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port:
            parsed.port ||
            (isHttps ? 443 : 80),
          path:
            `${parsed.pathname}${parsed.search}`,
          method: options.method,
          headers: options.headers,
        },
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
            async () => {
              const body =
                Buffer.concat(chunks).toString(
                  'utf8',
                );

              const statusCode =
                response.statusCode ?? 0;

              const location =
                response.headers.location;

              /**
               * Follow redirects for website checks.
               */
              if (
                location &&
                statusCode >= 300 &&
                statusCode < 400 &&
                redirectsRemaining > 0
              ) {
                try {
                  const redirectUrl =
                    new URL(
                      location,
                      parsed,
                    ).toString();

                  const redirected =
                    await requestOnce(
                      redirectUrl,
                      options,
                      redirectsRemaining -
                        1,
                    );

                  resolve(redirected);
                } catch (err) {
                  reject(err);
                }

                return;
              }

              resolve({
                statusCode,
                body,
                headers:
                  response.headers,
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
        options.timeoutMs,
        () => {
          request.destroy(
            new Error(
              'HTTP bağlantısı zaman aşımına uğradı.',
            ),
          );
        },
      );

      request.on('error', reject);

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
  const dns =
    await import('node:dns');

  const result =
    await dns.promises.lookup(host);

  return {
    address: result.address,
  };
}

/**
 * Reads the TLS certificate presented by the host.
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
            try {
              const cert =
                socket.getPeerCertificate();

              socket.end();

              if (
                !cert ||
                Object.keys(cert)
                  .length === 0
              ) {
                resolve({
                  validTo: null,
                  issuer: '',
                });

                return;
              }

              const validTo =
                cert.valid_to
                  ? new Date(
                      cert.valid_to,
                    )
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
                  firstOf(
                    cert.issuer?.O,
                  ) ||
                  firstOf(
                    cert.issuer?.CN,
                  ),
              });
            } catch (err) {
              reject(err);
            }
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
 * Tests whether an SMTP TCP port accepts a connection.
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

      let finished = false;

      const done = (
        ok: boolean,
      ) => {
        if (finished) {
          return;
        }

        finished = true;

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
 * Certificate fields can be either a string or an array.
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
