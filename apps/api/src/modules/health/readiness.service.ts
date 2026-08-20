import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/** What a connection is doing, in the three words an operator needs. */
export type ConnectionState = 'connected' | 'broken' | 'missing';

export interface ConnectionReport {
  /** Stable key the panel groups by. */
  key: string;
  label: string;
  state: ConnectionState;
  /** One sentence. What is wrong, or what is working. */
  detail: string;
  /** Environment variables that would fix a `missing`. Named, so nobody guesses. */
  missing?: string[];
}

/**
 * Whether the platform's connections are actually working.
 *
 * /health answers "is this process alive", which is what a load balancer needs
 * and almost never what a person needs. When publishing stops working the
 * question is which link broke — the database, the storage bucket, the deploy
 * hook, the mail provider — and until now the only way to answer it was to read
 * server logs nobody has access to.
 *
 * Every check is either a real round trip or an honest statement that no
 * credentials are configured. Nothing here reports "connected" on the strength
 * of a variable being non-empty.
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

  /** A real query, not a connection-string check. */
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
            ? err.message.split('\n')[0] ?? 'Bağlanılamadı'
            : 'Bağlanılamadı',
      };
    }
  }

  /**
   * How the schema migration went at startup.
   *
   * Reported because it is now allowed to fail without stopping the server.
   * That trade is only defensible if the failure is visible somewhere a person
   * looks — otherwise the API runs happily against a schema it does not match
   * and the first symptom is a query blowing up hours later.
   *
   * The value is left in the environment by scripts/start.mjs, which is the
   * same process, so no channel is needed between them.
   */
  private migrations(): ConnectionReport {
    const status = process.env['NEXUVA_MIGRATION_STATUS'];
    const detail = process.env['NEXUVA_MIGRATION_DETAIL'] ?? '';

    if (status === 'failed') {
      return {
        key: 'migrations',
        label: 'Veritabanı Şeması',
        state: 'broken',
        detail: `${detail} Şema beklenenden geride olabilir.`,
      };
    }

    if (status === 'skipped') {
      return {
        key: 'migrations',
        label: 'Veritabanı Şeması',
        state: 'missing',
        detail: `Migration atlandı (${detail}).`,
      };
    }

    if (status === 'ok') {
      return {
        key: 'migrations',
        label: 'Veritabanı Şeması',
        state: 'connected',
        detail: detail || 'Migration’lar güncel.',
      };
    }

    return {
      key: 'migrations',
      label: 'Veritabanı Şeması',
      state: 'missing',
      detail:
        'Bu süreç migration adımından geçmeden başlatılmış, bu yüzden şemanın güncel ' +
        'olduğu doğrulanamıyor.',
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
      .filter(([, key]) => !this.config.get<string>(key))
      .map(([name]) => name);

    if (missing.length > 0) {
      return {
        key: 'storage',
        label: 'Dosya Deposu (Veritabanı)',
        state: 'connected',
        detail:
          'Yükleme çalışıyor. Nesne deposu tanımlı olmadığı için dosyalar veritabanında ' +
          'saklanıyor ve API üzerinden sunuluyor — dosya başına 2 MB sınırı var. ' +
          'Aşağıdaki değişkenler tanımlanırsa Cloudflare R2 kullanılır.',
        missing,
      };
    }

    return {
      key: 'storage',
      label: 'Dosya Deposu (Cloudflare R2)',
      state: 'connected',
      detail: 'Yükleme açık, dosyalar CDN üzerinden sunuluyor.',
    };
  }

  /**
   * The publish chain, link by link.
   */
  private deploy(): ConnectionReport {
    const strategy =
      this.config.get<string>('publish.strategy') ?? 'none';

    if (strategy !== 'deploy-hook' && strategy !== 'revalidate') {
      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'missing',
        detail:
          'Yayın stratejisi seçilmemiş. Kaydedilen içerik sürüm olarak donuyor ama site ' +
          'yeniden derlenmiyor, yani ziyaretçi değişikliği görmüyor.',
        missing: ['PUBLISH_STRATEGY'],
      };
    }

    if (strategy === 'revalidate') {
      const missing = [
        ['FRONTEND_REVALIDATE_URL', 'publish.revalidateUrl'],
        ['FRONTEND_REVALIDATE_SECRET', 'publish.revalidateSecret'],
      ]
        .filter(([, key]) => !this.config.get<string>(key))
        .map(([name]) => name);

      if (missing.length > 0) {
        return {
          key: 'deploy',
          label: 'Yayın (ISR revalidate)',
          state: 'missing',
          detail:
            'Strateji "revalidate" ama adresi veya anahtarı tanımlı değil.',
          missing,
        };
      }

      return {
        key: 'deploy',
        label: 'Yayın (ISR revalidate)',
        state: 'connected',
        detail: 'Yayınlama önbelleği anında tazeliyor.',
      };
    }

    if (!this.config.get<string>('publish.deployHookUrl')) {
      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'missing',
        detail:
          'Strateji "deploy-hook" ama tetiklenecek adres tanımlı değil.',
        missing: ['RENDER_DEPLOY_HOOK_URL'],
      };
    }

    const canTrack =
      !!this.config.get<string>('publish.renderApiKey') &&
      !!this.config.get<string>('publish.renderServiceId');

    if (!canTrack) {
      const missing: string[] = [];

      if (!this.config.get<string>('publish.renderApiKey')) {
        missing.push('RENDER_API_KEY');
      }

      if (!this.config.get<string>('publish.renderServiceId')) {
        missing.push('RENDER_FRONTEND_SERVICE_ID');
      }

      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'broken',
        detail:
          'Derleme tetiklenebiliyor ama sonucu okunamıyor: başarısız bir derleme, ' +
          'başarılı olanla aynı görünür ve site sessizce eski kalır.',
        missing,
      };
    }

    return {
      key: 'deploy',
      label: 'Yayın (Render Deploy)',
      state: 'connected',
      detail: 'Derleme tetikleniyor ve sonucu geri okunuyor.',
    };
  }

  /**
   * Asks the hosting provider about the site's own service.
   */
  private async renderService(): Promise<ConnectionReport> {
    const key =
      this.config.get<string>('publish.renderApiKey') ?? '';

    const serviceId =
      this.config.get<string>('publish.renderServiceId') ?? '';

    if (!key || !serviceId) {
      return {
        key: 'render',
        label: 'Render (barındırma)',
        state: 'missing',
        detail:
          'Anahtar tanımlı olmadığı için derleme sonucu okunamıyor. Yayınlama çalışır, ' +
          'ama başarısız bir derleme panelde başarılı görünür.',
        missing: [
          ...(key ? [] : ['RENDER_API_KEY']),
          ...(serviceId ? [] : ['RENDER_FRONTEND_SERVICE_ID']),
        ],
      };
    }

    try {
      const res = await globalThis.fetch(
        `https://api.render.com/v1/services/${serviceId}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (res.status === 401 || res.status === 403) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            'API anahtarı reddedildi. Anahtar süresi dolmuş ya da yanlış olabilir.',
        };
      }

      if (res.status === 404) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            `Servis bulunamadı (${serviceId}). Servis kimliği yanlış ya da silinmiş.`,
        };
      }

      if (!res.ok) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail: `Render API HTTP ${res.status} döndü.`,
        };
      }

      const body = (await res.json()) as {
        name?: string;
        suspended?: string;
      };

      const suspended = body.suspended === 'suspended';

      return {
        key: 'render',
        label: 'Render (barındırma)',
        state: suspended ? 'broken' : 'connected',
        detail: suspended
          ? `"${body.name ?? serviceId}" askıya alınmış. Site yayında değil.`
          : `"${body.name ?? serviceId}" servisi erişilebilir, derleme sonuçları okunabiliyor.`,
      };
    } catch {
      return {
        key: 'render',
        label: 'Render (barındırma)',
        state: 'broken',
        detail: 'Render API\'sine ulaşılamadı.',
      };
    }
  }

  /**
   * Does the site's address resolve, and to what?
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
        detail: `"${url}" geçerli bir adres değil.`,
      };
    }

    try {
      const { address } = await lookup(host);
      const isPlatformDefault = host.endsWith('.onrender.com');

      return {
        key: 'domain',
        label: 'Alan Adı',
        state: 'connected',
        detail: isPlatformDefault
          ? `${host} → ${address}. Bu barındırma sağlayıcısının varsayılan adresi; kurumsal bir alan adı henüz bağlanmamış.`
          : `${host} → ${address}.`,
      };
    } catch {
      return {
        key: 'domain',
        label: 'Alan Adı',
        state: 'broken',
        detail:
          `${host} çözümlenemiyor. DNS kaydı eksik ya da yayılmamış.`,
      };
    }
  }

  /**
   * Reads the site's actual TLS certificate and says when it expires.
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
            'Site adresi https değil. Ziyaretçi bağlantısı şifrelenmiyor.',
        };
      }

      host = parsed.hostname;
    } catch {
      return {
        key: 'ssl',
        label: 'SSL Sertifikası',
        state: 'broken',
        detail: 'Adres okunamadı.',
      };
    }

    try {
      const cert = await readCertificate(host);

      if (!cert.validTo) {
        return {
          key: 'ssl',
          label: 'SSL Sertifikası',
          state: 'broken',
          detail: 'Sertifika okunamadı.',
        };
      }

      const daysLeft = Math.floor(
        (cert.validTo.getTime() - Date.now()) / 86_400_000,
      );

      const expiry =
        cert.validTo.toLocaleDateString('tr-TR');

      if (daysLeft < 0) {
        return {
          key: 'ssl',
          label: 'SSL Sertifikası',
          state: 'broken',
          detail:
            `Sertifika ${expiry} tarihinde doldu. Ziyaretçiler güvenlik uyarısı görüyor.`,
        };
      }

      if (daysLeft < 14) {
        return {
          key: 'ssl',
          label: 'SSL Sertifikası',
          state: 'broken',
          detail:
            `Sertifikanın bitmesine ${daysLeft} gün kaldı (${expiry}). Yenilenmesi gerekiyor.`,
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
   * Is traffic actually being measured?
   */
  private async analytics(): Promise<ConnectionReport> {
    try {
      const since = new Date(
        Date.now() - 7 * 86_400_000,
      );

      const recent = await this.prisma.pageView.count({
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
            `Son 7 günde ${recent} sayfa görüntüleme kaydedildi. Çerez kullanılmıyor, IP saklanmıyor.`,
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
            ? 'Ölçüm kurulu ama son 7 günde kayıt yok. Siteye ziyaret gelmemiş olabilir.'
            : 'Ölçüm kodu hazır ama henüz veri gelmedi. Siteyi bir kez yayınlayıp ziyaret et.',
      };
    } catch {
      return {
        key: 'analytics',
        label: 'Ziyaretçi Ölçümü',
        state: 'broken',
        detail: 'Ziyaretçi kayıtları okunamadı.',
      };
    }
  }

  private async email(): Promise<ConnectionReport> {
    const provider =
      this.config.get<string>('email.provider') ?? 'resend';

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
          'Ayarlanmadığı için yeni talep bildirimleri e-posta ile gitmiyor. Talep yine kaydediliyor.',
        missing: [name],
      };
    }

    try {
      if (provider === 'resend') {
        const res = await globalThis.fetch(
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
              'API anahtarı reddedildi. Bildirim e-postaları gönderilemiyor.',
          };
        }

        if (!res.ok) {
          return {
            key: 'email',
            label: 'E-posta (resend)',
            state: 'broken',
            detail:
              `Resend HTTP ${res.status} döndü.`,
          };
        }

        return {
          key: 'email',
          label: 'E-posta (resend)',
          state: 'connected',
          detail:
            'Anahtar geçerli, sağlayıcı yanıt veriyor.',
        };
      }

      if (provider === 'smtp') {
        const host = value;

        const port =
          this.config.get<number>(
            'email.smtp.port',
          ) ?? 587;

        const reachable = await canConnect(
          host,
          port,
          8000,
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
            `${host}:${port} bağlantıyı kabul etmiyor. Sunucu adı veya port yanlış olabilir.`,
        };
      }

      const res = await globalThis.fetch(
        'https://api.sendgrid.com/v3/scopes',
        {
          headers: {
            Authorization: `Bearer ${value}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (res.ok) {
        return {
          key: 'email',
          label: 'E-posta (sendgrid)',
          state: 'connected',
          detail:
            'Anahtar geçerli, sağlayıcı yanıt veriyor.',
        };
      }

      return {
        key: 'email',
        label: 'E-posta (sendgrid)',
        state: 'broken',
        detail:
          `SendGrid HTTP ${res.status} döndü.`,
      };
    } catch {
      return {
        key: 'email',
        label: `E-posta (${provider})`,
        state: 'broken',
        detail: 'Sağlayıcıya ulaşılamadı.',
      };
    }
  }

  /**
   * Is the published site actually being served?
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
          'Site adresi tanımlı değil, bu yüzden yayının ziyaretçiye ulaştığı doğrulanamıyor.',
        missing: ['SITE_URL'],
      };
    }

    try {
      const res = await globalThis.fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        return {
          key: 'website',
          label: 'Web Sitesi',
          state: 'connected',
          detail: `${url} yanıt veriyor.`,
        };
      }

      return {
        key: 'website',
        label: 'Web Sitesi',
        state: 'broken',
        detail:
          `${url} → HTTP ${res.status}. Site yayında değil; yayınlanan içerik ziyaretçiye ulaşmıyor.`,
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
//
// These exist because "the variable is set" is not an answer to "does it work",
// and every check on this screen is supposed to answer the second question.

/** Resolves a hostname the way a browser would. */
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

/** Reads the certificate a host presents, without sending a request. */
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
            new Error('zaman aşımı'),
          );
        },
      );
    },
  );
}

/** Whether a TCP port accepts a connection. Used for SMTP, which has no HTTP. */
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
        if (settled) return;

        settled = true;
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

/** Certificate fields can be a string or a list of them. */
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
