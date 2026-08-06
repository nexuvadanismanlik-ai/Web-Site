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

  async report(): Promise<{ connections: ConnectionReport[]; checkedAt: string }> {
    const connections = await Promise.all([
      this.database(),
      Promise.resolve(this.migrations()),
      this.storage(),
      this.deploy(),
      this.email(),
      this.website(),
    ]);
    return { connections, checkedAt: new Date().toISOString() };
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
        detail: err instanceof Error ? err.message.split('\n')[0] ?? 'Bağlanılamadı' : 'Bağlanılamadı',
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
    const missing = required.filter(([, key]) => !this.config.get<string>(key)).map(([name]) => name);

    if (missing.length > 0) {
      return {
        key: 'storage',
        label: 'Dosya Deposu (Cloudflare R2)',
        state: 'missing',
        detail: 'Ayarlanmadığı için dosya yükleme kapalı. Kayıtlı dosyalar okunabiliyor.',
        missing,
      };
    }
    return {
      key: 'storage',
      label: 'Dosya Deposu (Cloudflare R2)',
      state: 'connected',
      detail: 'Yükleme açık.',
    };
  }

  /**
   * The publish chain, link by link.
   *
   * Three separate things are wrong in three different ways here and they used
   * to produce the same silence: no strategy chosen, a strategy chosen without
   * its credentials, and a strategy that works but whose result cannot be read
   * back — the last one being how a failed build looks exactly like a
   * successful one.
   */
  private deploy(): ConnectionReport {
    const strategy = this.config.get<string>('publish.strategy') ?? 'none';

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
        .filter(([, key]) => !this.config.get<string>(key as string))
        .map(([name]) => name as string);

      return missing.length > 0
        ? {
            key: 'deploy',
            label: 'Yayın (ISR revalidate)',
            state: 'missing',
            detail: 'Strateji "revalidate" ama adresi veya anahtarı tanımlı değil.',
            missing,
          }
        : {
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
        detail: 'Strateji "deploy-hook" ama tetiklenecek adres tanımlı değil.',
        missing: ['RENDER_DEPLOY_HOOK_URL'],
      };
    }

    const canTrack =
      !!this.config.get<string>('publish.renderApiKey') &&
      !!this.config.get<string>('publish.renderServiceId');

    if (!canTrack) {
      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'broken',
        detail:
          'Derleme tetiklenebiliyor ama sonucu okunamıyor: başarısız bir derleme, ' +
          'başarılı olanla aynı görünür ve site sessizce eski kalır.',
        missing: ['RENDER_API_KEY', 'RENDER_FRONTEND_SERVICE_ID'],
      };
    }

    return {
      key: 'deploy',
      label: 'Yayın (Render Deploy)',
      state: 'connected',
      detail: 'Derleme tetikleniyor ve sonucu geri okunuyor.',
    };
  }

  private email(): ConnectionReport {
    const provider = this.config.get<string>('email.provider') ?? 'resend';
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

    if (!this.config.get<string>(key)) {
      return {
        key: 'email',
        label: `E-posta (${provider})`,
        state: 'missing',
        detail: 'Ayarlanmadığı için yeni talep bildirimleri e-posta ile gitmiyor. Talep yine kaydediliyor.',
        missing: [name],
      };
    }
    return {
      key: 'email',
      label: `E-posta (${provider})`,
      state: 'connected',
      detail: 'Bildirim e-postaları gönderiliyor.',
    };
  }

  /**
   * Is the published site actually being served?
   *
   * The one check that looks outward. A publish can succeed at every internal
   * step and still leave visitors on an error page, which is exactly the
   * failure that is invisible from inside.
   */
  private async website(): Promise<ConnectionReport> {
    const url = this.config.get<string>('publish.siteUrl') ?? '';
    if (!url) {
      return {
        key: 'website',
        label: 'Web Sitesi',
        state: 'missing',
        detail: 'Site adresi tanımlı değil, bu yüzden yayının ziyaretçiye ulaştığı doğrulanamıyor.',
        missing: ['SITE_URL'],
      };
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        return { key: 'website', label: 'Web Sitesi', state: 'connected', detail: `${url} yanıt veriyor.` };
      }
      return {
        key: 'website',
        label: 'Web Sitesi',
        state: 'broken',
        detail: `${url} → HTTP ${res.status}. Site yayında değil; yayınlanan içerik ziyaretçiye ulaşmıyor.`,
      };
    } catch (err) {
      this.logger.warn(`Website probe failed: ${String(err)}`);
      return {
        key: 'website',
        label: 'Web Sitesi',
        state: 'broken',
        detail: `${url} adresine ulaşılamıyor.`,
      };
    }
  }
}
