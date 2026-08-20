import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

type HttpResponse = {
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
};

type HttpRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

async function httpFetch(
  url: string,
  options?: HttpRequestInit,
): Promise<HttpResponse> {
  const response = await globalThis.fetch(url, options);

  return response as unknown as HttpResponse;
}

/** What a connection is doing, in the three words an operator needs. */
export type ConnectionState =
  | 'connected'
  | 'broken'
  | 'missing';

export interface ConnectionReport {
  /** Stable key the panel groups by. */
  key: string;
  label: string;
  state: ConnectionState;
  /** One sentence. What is wrong, or what is working. */
  detail: string;
  /** Environment variables that would fix a `missing`. */
  missing?: string[];
}

/**
 * Whether the platform's connections are actually working.
 *
 * /health answers "is this process alive".
 * This service answers "are the important external connections actually
 * working?"
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

  /** A real database query. */
  private async database(): Promise<ConnectionReport> {
    const started = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        key: 'database',
        label: 'Veritabanı (Supabase)',
        state: 'connected',
        detail:
          `Sorgu ${Date.now() - started} ms içinde döndü.`,
      };
    } catch (err) {
      return {
        key: 'database',
        label: 'Veritabanı (Supabase)',
        state: 'broken',
        detail:
          err instanceof Error
            ? err.message.split('\n')[0] ??
              'Bağlanılamadı'
            : 'Bağlanılamadı',
      };
    }
  }

  /**
   * Reports migration status written by scripts/start.mjs.
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
          `${detail} Şema beklenenden geride olabilir.`,
      };
    }

    if (status === 'skipped') {
      return {
        key: 'migrations',
        label: 'Veritabanı Şeması',
        state: 'missing',
        detail:
          `Migration atlandı (${detail}).`,
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
        'Bu yüzden şemanın güncel olduğu doğrulanamıyor.',
    };
  }

  private storage(): ConnectionReport {
    const required = [
      ['R2_ACCOUNT_ID', 'storage.accountId'],
      ['R2_ACCESS_KEY_ID', 'storage.accessKeyId'],
      ['R2_SECRET_ACCESS_KEY', 'storage.secretAccessKey'],
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
          'Yükleme çalışıyor. Nesne deposu tanımlı olmadığı için ' +
          'dosyalar veritabanında saklanıyor ve API üzerinden sunuluyor. ' +
          'Dosya başına 2 MB sınırı var. Cloudflare R2 tanımlanırsa ' +
          'dosyalar nesne deposuna taşınabilir.',
        missing,
      };
    }

    return {
      key: 'storage',
      label: 'Dosya Deposu (Cloudflare R2)',
      state: 'connected',
      detail:
        'Yükleme yapılandırılmış ve Cloudflare R2 ayarları mevcut.',
    };
  }

  /**
   * Checks the configured publication strategy.
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
          'Yayın stratejisi seçilmemiş. Kaydedilen içerik ' +
          'site yeniden derlenmediği sürece ziyaretçiye ulaşmaz.',
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
            'Strateji "revalidate" fakat adres veya gizli anahtar tanımlı değil.',
          missing,
        };
      }

      return {
        key: 'deploy',
        label: 'Yayın (ISR revalidate)',
        state: 'connected',
        detail:
          'Yayınlama önbelleği tazelemek için yapılandırılmış.',
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
          'Strateji "deploy-hook" fakat tetiklenecek adres tanımlı değil.',
        missing: ['RENDER_DEPLOY_HOOK_URL'],
      };
    }

    const canTrack =
      !!this.config.get<string>(
        'publish.renderApiKey',
      ) &&
      !!this.config.get<string>(
        'publish.renderServiceId',
      );

    if (!canTrack) {
      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'broken',
        detail:
          'Deploy tetiklenebilir ancak Render API bilgileri ' +
          'eksik olduğu için deploy sonucu doğrulanamıyor.',
        missing: [
          ...(this.config.get<string>(
            'publish.renderApiKey',
          )
            ? []
            : ['RENDER_API_KEY']),
          ...(this.config.get<string>(
            'publish.renderServiceId',
          )
            ? []
            : ['RENDER_FRONTEND_SERVICE_ID']),
        ],
      };
    }

    return {
      key: 'deploy',
      label: 'Yayın (Render Deploy)',
      state: 'connected',
      detail:
        'Deploy tetikleme ve Render servis kontrolü yapılandırılmış.',
    };
  }

  /**
   * Checks Render service availability through the Render API.
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
      return {
        key: 'render',
        label: 'Render (barındırma)',
        state: 'missing',
        detail:
          'Render API anahtarı veya servis kimliği tanımlı değil.',
        missing: [
          ...(key
            ? []
            : ['RENDER_API_KEY']),
          ...(serviceId
            ? []
            : ['RENDER_FRONTEND_SERVICE_ID']),
        ],
      };
    }

    try {
      const res = await httpFetch(
        `https://api.render.com/v1/services/${serviceId}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (
        res.status === 401 ||
        res.status === 403
      ) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            'Render API anahtarı reddedildi. Anahtar yanlış, ' +
            'geçersiz veya yetkisiz olabilir.',
        };
      }

      if (res.status === 404) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            `Render servisi bulunamadı (${serviceId}). ` +
            'Servis kimliği yanlış veya servis silinmiş olabilir.',
        };
      }

      if (!res.ok) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            `Render API HTTP ${res.status} döndürdü.`,
        };
      }

      const body =
        (await res.json()) as {
          name?: string;
          suspended?: string;
        };

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
          : `"${body.name ?? serviceId}" servisi Render API üzerinden erişilebilir.`,
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
   * Checks whether the configured site hostname resolves.
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
          ? `${host} → ${address}. Render varsayılan adresi kullanılıyor.`
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
   * Reads the site's actual TLS certificate.
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
          'Site adresi tanımlı olmadığı için sertifika kontrol edilemiyor.',
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
            'Site adresi HTTPS değil.',
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
            'TLS sertifikası okunamadı.',
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
   * Checks whether analytics has actually received page views.
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
            ? 'Ölçüm kurulu ancak son 7 günde kayıt yok.'
            : 'Ölçüm kodu hazır ancak henüz veri gelmedi.',
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
          'E-posta sağlayıcısı yapılandırılmamış. ' +
          'Yeni talep bildirimleri gönderilemiyor.',
        missing: [name],
      };
    }

    try {
      if (provider === 'resend') {
        const res = await httpFetch(
          'https://api.resend.com/domains',
          {
            headers: {
              Authorization: `Bearer ${value}`,
            },
            signal: AbortSignal.timeout(10_000),
          },
        );

        if (
          res.status === 401 ||
          res.status === 403
        ) {
          return {
            key: 'email',
            label: 'E-posta (resend)',
            state: 'broken',
            detail:
              'Resend API anahtarı reddedildi.',
          };
        }

        if (!res.ok) {
          return {
            key: 'email',
            label: 'E-posta (resend)',
            state: 'broken',
            detail:
              `Resend HTTP ${res.status} döndürdü.`,
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
            8000,
          );

        return reachable
          ? {
              key: 'email',
              label: 'E-posta (smtp)',
              state: 'connected',
              detail:
                `${host}:${port} bağlantıyı kabul ediyor.`,
            }
          : {
              key: 'email',
              label: 'E-posta (smtp)',
              state: 'broken',
              detail:
                `${host}:${port} bağlantıyı kabul etmiyor.`,
            };
      }

      const res = await httpFetch(
        'https://api.sendgrid.com/v3/scopes',
        {
          headers: {
            Authorization: `Bearer ${value}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      return res.ok
        ? {
            key: 'email',
            label: 'E-posta (sendgrid)',
            state: 'connected',
            detail:
              'SendGrid API anahtarı geçerli ve sağlayıcı yanıt veriyor.',
          }
        : {
            key: 'email',
            label: 'E-posta (sendgrid)',
            state: 'broken',
            detail:
              `SendGrid HTTP ${res.status} döndürdü.`,
          };
    } catch {
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
   * Checks whether the published website responds.
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
      const res = await httpFetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        return {
          key: 'website',
          label: 'Web Sitesi',
          state: 'connected',
          detail:
            `${url} yanıt veriyor.`,
        };
      }

      return {
        key: 'website',
        label: 'Web Sitesi',
        state: 'broken',
        detail:
          `${url} → HTTP ${res.status}. Site düzgün yanıt vermiyor.`,
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

// ─── Real-connection helpers ──────────────────────────────────────────────────

/** Resolves a hostname. */
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

/** Reads the TLS certificate presented by a host. */
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
      const socket = tls.connect(
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

          const validTo = cert.valid_to
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
              'zaman aşımı',
            ),
          );
        },
      );
    },
  );
}

/** Checks whether a TCP port accepts a connection. */
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

      const done = (ok: boolean) => {
        if (finished) {
          return;
        }

        finished = true;
        socket.destroy();
        resolve(ok);
      };

      socket.setTimeout(timeoutMs);

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

/** Certificate fields can be a string or an array. */
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
