import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export type ConnectionState =
  | 'connected'
  | 'broken'
  | 'missing';

export interface ConnectionReport {
  key: string;
  label: string;
  state: ConnectionState;
  detail: string;
  missing?: string[];
}

interface RenderServiceResponse {
  id?: string;
  name?: string;
  type?: string;
  suspended?: string;
  autoDeploy?: string;
  branch?: string;
  repo?: string;
  serviceDetails?: {
    url?: string;
  };
}

interface RenderDeploy {
  id?: string;
  status?: string;
  commit?: {
    id?: string;
    message?: string;
    createdAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string;
  trigger?: string;
  image?: {
    ref?: string;
  };
}

interface RenderDeployListResponse {
  deploys?: RenderDeploy[];
  cursor?: string;
}

/**
 * Checks whether the platform's important connections are actually working.
 *
 * Important:
 *
 * - A configured environment variable does NOT automatically mean that the
 *   connection works.
 * - Render is checked through the real Render API.
 * - The latest Render deploy is read from the Render deploys endpoint.
 * - A Render service being alive is NOT the same thing as the latest deploy
 *   being successful.
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
    const connections =
      await Promise.all([
        this.database(),
        Promise.resolve(this.migrations()),
        Promise.resolve(this.storage()),
        this.deploy(),
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
   * Real database round trip.
   */
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
          `${detail || 'Migration başarısız oldu.'} ` +
          'Şema beklenenden geride olabilir.',
      };
    }

    if (status === 'skipped') {
      return {
        key: 'migrations',
        label: 'Veritabanı Şeması',
        state: 'missing',
        detail:
          `Migration atlandı${detail ? ` (${detail})` : '.'}`,
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
        'Bu süreç migration adımından geçmeden ' +
        'başlatılmış. Şemanın güncel olduğu doğrulanamıyor.',
    };
  }

  /**
   * Checks storage configuration.
   *
   * We do NOT claim that database file storage works merely because R2
   * variables are missing. We only report which storage mode is configured.
   */
  private storage(): ConnectionReport {
    const r2AccountId =
      this.config.get<string>(
        'storage.accountId',
      );

    const r2AccessKeyId =
      this.config.get<string>(
        'storage.accessKeyId',
      );

    const r2SecretAccessKey =
      this.config.get<string>(
        'storage.secretAccessKey',
      );

    const r2PublicUrl =
      this.config.get<string>(
        'storage.publicUrl',
      );

    const missing: string[] = [];

    if (!r2AccountId) {
      missing.push('R2_ACCOUNT_ID');
    }

    if (!r2AccessKeyId) {
      missing.push('R2_ACCESS_KEY_ID');
    }

    if (!r2SecretAccessKey) {
      missing.push('R2_SECRET_ACCESS_KEY');
    }

    if (!r2PublicUrl) {
      missing.push('R2_PUBLIC_URL');
    }

    if (missing.length > 0) {
      return {
        key: 'storage',
        label: 'Dosya Deposu',
        state: 'missing',
        detail:
          'Cloudflare R2 yapılandırılmamış. ' +
          'R2 değişkenleri tanımlandığında nesne depolama ' +
          'kullanılabilir.',
        missing,
      };
    }

    return {
      key: 'storage',
      label: 'Dosya Deposu (Cloudflare R2)',
      state: 'connected',
      detail:
        'R2 yapılandırması mevcut.',
    };
  }

  /**
   * Checks the actual Render deployment state.
   *
   * THIS is the important correction.
   *
   * The old version only checked whether:
   *
   *   - a deploy hook existed
   *   - an API key existed
   *   - a service ID existed
   *
   * That did NOT prove that a deployment actually happened.
   *
   * This version asks Render for the latest deploy belonging to the service.
   */
  private async deploy(): Promise<ConnectionReport> {
    const strategy =
      this.config.get<string>(
        'publish.strategy',
      ) ?? 'deploy-hook';

    if (
      strategy !== 'deploy-hook' &&
      strategy !== 'revalidate'
    ) {
      return {
        key: 'deploy',
        label: 'Yayın',
        state: 'missing',
        detail:
          'Yayın stratejisi tanımlı değil.',
        missing: ['PUBLISH_STRATEGY'],
      };
    }

    /**
     * ISR / revalidation does not create a Render deployment.
     */
    if (strategy === 'revalidate') {
      const revalidateUrl =
        this.config.get<string>(
          'publish.revalidateUrl',
        );

      const revalidateSecret =
        this.config.get<string>(
          'publish.revalidateSecret',
        );

      const missing: string[] = [];

      if (!revalidateUrl) {
        missing.push(
          'FRONTEND_REVALIDATE_URL',
        );
      }

      if (!revalidateSecret) {
        missing.push(
          'FRONTEND_REVALIDATE_SECRET',
        );
      }

      if (missing.length > 0) {
        return {
          key: 'deploy',
          label: 'Yayın (ISR revalidate)',
          state: 'missing',
          detail:
            'Revalidate stratejisi seçilmiş fakat gerekli ' +
            'ayarlar eksik.',
          missing,
        };
      }

      return {
        key: 'deploy',
        label: 'Yayın (ISR revalidate)',
        state: 'connected',
        detail:
          'ISR revalidate yapılandırması mevcut.',
      };
    }

    const apiKey =
      this.config.get<string>(
        'publish.renderApiKey',
      ) ?? '';

    const serviceId =
      this.config.get<string>(
        'publish.renderServiceId',
      ) ?? '';

    const deployHookUrl =
      this.config.get<string>(
        'publish.deployHookUrl',
      ) ?? '';

    if (!apiKey || !serviceId) {
      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'missing',
        detail:
          'Render API bağlantısı için API anahtarı veya ' +
          'frontend Render servis ID’si eksik.',
        missing: [
          ...(apiKey
            ? []
            : ['RENDER_API_KEY']),
          ...(serviceId
            ? []
            : ['RENDER_FRONTEND_SERVICE_ID']),
        ],
      };
    }

    /**
     * Deploy hook is useful for triggering the deploy, but the API is needed
     * here to verify what actually happened.
     */
    if (!deployHookUrl) {
      this.logger.warn(
        'Render deploy hook is not configured. ' +
        'Latest deploy can still be read through the Render API.',
      );
    }

    try {
      const url =
        `https://api.render.com/v1/services/` +
        `${encodeURIComponent(serviceId)}/deploys` +
        `?limit=1`;

      const response =
        await fetch(url, {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
            Accept:
              'application/json',
          },
          signal:
            AbortSignal.timeout(10_000),
        });

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        return {
          key: 'deploy',
          label: 'Yayın (Render Deploy)',
          state: 'broken',
          detail:
            'Render API anahtarı reddedildi. ' +
            'API anahtarını kontrol edin.',
        };
      }

      if (response.status === 404) {
        return {
          key: 'deploy',
          label: 'Yayın (Render Deploy)',
          state: 'broken',
          detail:
            `Render servisi bulunamadı (${serviceId}). ` +
            'Service ID yanlış olabilir veya servis silinmiş olabilir.',
        };
      }

      if (!response.ok) {
        return {
          key: 'deploy',
          label: 'Yayın (Render Deploy)',
          state: 'broken',
          detail:
            `Render deploy API HTTP ${response.status} döndü.`,
        };
      }

      const body =
        (await response.json()) as
          | RenderDeployListResponse
          | RenderDeploy[];

      const deploys =
        Array.isArray(body)
          ? body
          : body.deploys ?? [];

      if (deploys.length === 0) {
        return {
          key: 'deploy',
          label: 'Yayın (Render Deploy)',
          state: 'missing',
          detail:
            'Render servisi bulundu fakat bu servis için ' +
            'henüz okunabilir bir deploy kaydı bulunamadı.',
        };
      }

      const latest = deploys[0];

      const status =
        String(
          latest.status ?? '',
        ).toLowerCase();

      const deployId =
        latest.id ?? 'bilinmiyor';

      const commitId =
        latest.commit?.id ??
        'commit bilgisi yok';

      const commitMessage =
        latest.commit?.message
          ? latest.commit.message
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 120)
          : '';

      const createdAt =
        formatDate(
          latest.createdAt,
        );

      const finishedAt =
        formatDate(
          latest.finishedAt,
        );

      const trigger =
        latest.trigger ??
        'bilinmiyor';

      /**
       * Render deploy status values can evolve, so we classify known failure
       * and in-progress states explicitly and keep unknown states visible.
       */
      const failedStatuses =
        new Set([
          'failed',
          'canceled',
          'cancelled',
          'deactivated',
        ]);

      const activeStatuses =
        new Set([
          'created',
          'build_in_progress',
          'update_in_progress',
          'queued',
          'pending',
        ]);

      const successfulStatuses =
        new Set([
          'live',
        ]);

      if (failedStatuses.has(status)) {
        return {
          key: 'deploy',
          label: 'Yayın (Render Deploy)',
          state: 'broken',
          detail:
            `Son Render deploy’u başarısız/iptal edilmiş. ` +
            `Durum: ${status}. ` +
            `Deploy: ${deployId}. ` +
            `Commit: ${commitId}.` +
            (commitMessage
              ? ` Mesaj: ${commitMessage}.`
              : '') +
            (createdAt
              ? ` Başlangıç: ${createdAt}.`
              : ''),
        };
      }

      if (activeStatuses.has(status)) {
        return {
          key: 'deploy',
          label: 'Yayın (Render Deploy)',
          state: 'missing',
          detail:
            `Render deploy’u hâlâ devam ediyor. ` +
            `Durum: ${status}. ` +
            `Deploy: ${deployId}. ` +
            `Commit: ${commitId}.`,
        };
      }

      if (successfulStatuses.has(status)) {
        return {
          key: 'deploy',
          label: 'Yayın (Render Deploy)',
          state: 'connected',
          detail:
            `Son Render deploy’u başarıyla yayında. ` +
            `Deploy: ${deployId}. ` +
            `Commit: ${commitId}. ` +
            `Tetikleyici: ${trigger}.` +
            (commitMessage
              ? ` Mesaj: ${commitMessage}.`
              : '') +
            (createdAt
              ? ` Başlangıç: ${createdAt}.`
              : '') +
            (finishedAt
              ? ` Bitiş: ${finishedAt}.`
              : ''),
        };
      }

      /**
       * Unknown status should NEVER silently become connected.
       */
      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'broken',
        detail:
          `Render son deploy için bilinmeyen durum döndürdü: ` +
          `"${status || 'boş'}". ` +
          `Deploy: ${deployId}.`,
      };
    } catch (err) {
      this.logger.warn(
        `Render deploy check failed: ${String(err)}`,
      );

      return {
        key: 'deploy',
        label: 'Yayın (Render Deploy)',
        state: 'broken',
        detail:
          'Render deploy API’sine ulaşılamadı.',
      };
    }
  }

  /**
   * Checks whether the Render service itself is accessible.
   *
   * This is intentionally separate from deploy().
   *
   * renderService() answers:
   *
   *   "Is the Render service reachable?"
   *
   * deploy() answers:
   *
   *   "What happened with the latest deployment?"
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
          'Render API anahtarı veya servis ID’si tanımlı değil.',
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
      const response =
        await fetch(
          `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}`,
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${key}`,
              Accept:
                'application/json',
            },
            signal:
              AbortSignal.timeout(10_000),
          },
        );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            'Render API anahtarı reddedildi.',
        };
      }

      if (response.status === 404) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            `Render servisi bulunamadı (${serviceId}).`,
        };
      }

      if (!response.ok) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            `Render API HTTP ${response.status} döndü.`,
        };
      }

      const body =
        (await response.json()) as
          RenderServiceResponse;

      const suspended =
        body.suspended === 'suspended';

      if (suspended) {
        return {
          key: 'render',
          label: 'Render (barındırma)',
          state: 'broken',
          detail:
            `"${body.name ?? serviceId}" Render tarafından ` +
            'askıya alınmış.',
        };
      }

      return {
        key: 'render',
        label: 'Render (barındırma)',
        state: 'connected',
        detail:
          `"${body.name ?? serviceId}" Render servisi erişilebilir.`,
      };
    } catch (err) {
      this.logger.warn(
        `Render service check failed: ${String(err)}`,
      );

      return {
        key: 'render',
        label: 'Render (barındırma)',
        state: 'broken',
        detail:
          'Render API’sine ulaşılamadı.',
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
      host =
        new URL(url).hostname;
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
        detail:
          isPlatformDefault
            ? `${host} → ${address}. Render varsayılan adresi kullanılıyor.`
            : `${host} → ${address}. DNS çözümlemesi başarılı.`,
      };
    } catch {
      return {
        key: 'domain',
        label: 'Alan Adı',
        state: 'broken',
        detail:
          `${host} çözümlenemiyor. DNS kaydı eksik veya yayılmamış olabilir.`,
      };
    }
  }

  /**
   * Reads the actual TLS certificate presented by the website.
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
          'Site adresi tanımlı olmadığı için SSL kontrolü yapılamıyor.',
        missing: ['SITE_URL'],
      };
    }

    let host: string;

    try {
      const parsed =
        new URL(url);

      if (parsed.protocol !== 'https:') {
        return {
          key: 'ssl',
          label: 'SSL Sertifikası',
          state: 'broken',
          detail:
            'Site adresi HTTPS kullanmıyor.',
        };
      }

      host =
        parsed.hostname;
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
            'Sunucunun SSL sertifikası okunamadı.',
        };
      }

      const daysLeft =
        Math.floor(
          (
            cert.validTo.getTime() -
            Date.now()
          ) /
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
            `Sertifika ${expiry} tarihinde süresi dolmuş.`,
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
          `Geçerli. ${expiry} tarihine kadar kullanılabilir.` +
          ` Veren: ${cert.issuer || 'bilinmiyor'}.`,
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
   * Checks whether page-view records are actually being received.
   */
  private async analytics(): Promise<ConnectionReport> {
    try {
      const since =
        new Date(
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
            ? 'Ölçüm kurulu fakat son 7 günde yeni kayıt yok.'
            : 'Henüz ziyaretçi ölçümü kaydı alınmadı.',
      };
    } catch (err) {
      this.logger.warn(
        `Analytics check failed: ${String(err)}`,
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
   * Checks the configured email provider.
   */
  private async email(): Promise<ConnectionReport> {
    const provider =
      (
        this.config.get<string>(
          'email.provider',
        ) ?? 'resend'
      ).toLowerCase();

    if (provider === 'smtp') {
      return this.checkSmtp();
    }

    if (provider === 'sendgrid') {
      return this.checkSendgrid();
    }

    return this.checkResend();
  }

  /**
   * Resend API check.
   */
  private async checkResend(): Promise<ConnectionReport> {
    const key =
      this.config.get<string>(
        'email.resendApiKey',
      ) ?? '';

    if (!key) {
      return {
        key: 'email',
        label: 'E-posta (Resend)',
        state: 'missing',
        detail:
          'Resend API anahtarı tanımlı değil.',
        missing: ['RESEND_API_KEY'],
      };
    }

    try {
      const response =
        await fetch(
          'https://api.resend.com/domains',
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${key}`,
              Accept:
                'application/json',
            },
            signal:
              AbortSignal.timeout(10_000),
          },
        );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        return {
          key: 'email',
          label: 'E-posta (Resend)',
          state: 'broken',
          detail:
            'Resend API anahtarı reddedildi.',
        };
      }

      if (!response.ok) {
        return {
          key: 'email',
          label: 'E-posta (Resend)',
          state: 'broken',
          detail:
            `Resend HTTP ${response.status} döndü.`,
        };
      }

      return {
        key: 'email',
        label: 'E-posta (Resend)',
        state: 'connected',
        detail:
          'Resend API bağlantısı çalışıyor.',
      };
    } catch {
      return {
        key: 'email',
        label: 'E-posta (Resend)',
        state: 'broken',
        detail:
          'Resend API’sine ulaşılamadı.',
      };
    }
  }

  /**
   * SendGrid API check.
   */
  private async checkSendgrid(): Promise<ConnectionReport> {
    const key =
      this.config.get<string>(
        'email.sendgridApiKey',
      ) ?? '';

    if (!key) {
      return {
        key: 'email',
        label: 'E-posta (SendGrid)',
        state: 'missing',
        detail:
          'SendGrid API anahtarı tanımlı değil.',
        missing: ['SENDGRID_API_KEY'],
      };
    }

    try {
      const response =
        await fetch(
          'https://api.sendgrid.com/v3/scopes',
          {
            method: 'GET',
            headers: {
              Authorization:
                `Bearer ${key}`,
              Accept:
                'application/json',
            },
            signal:
              AbortSignal.timeout(10_000),
          },
        );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        return {
          key: 'email',
          label: 'E-posta (SendGrid)',
          state: 'broken',
          detail:
            'SendGrid API anahtarı reddedildi.',
        };
      }

      if (!response.ok) {
        return {
          key: 'email',
          label: 'E-posta (SendGrid)',
          state: 'broken',
          detail:
            `SendGrid HTTP ${response.status} döndü.`,
        };
      }

      return {
        key: 'email',
        label: 'E-posta (SendGrid)',
        state: 'connected',
        detail:
          'SendGrid API bağlantısı çalışıyor.',
      };
    } catch {
      return {
        key: 'email',
        label: 'E-posta (SendGrid)',
        state: 'broken',
        detail:
          'SendGrid API’sine ulaşılamadı.',
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
        label: 'E-posta (SMTP)',
        state: 'missing',
        detail:
          'SMTP sunucu adresi tanımlı değil.',
        missing: ['SMTP_HOST'],
      };
    }

    try {
      const reachable =
        await canConnect(
          host,
          port,
          8000,
        );

      if (reachable) {
        return {
          key: 'email',
          label: 'E-posta (SMTP)',
          state: 'connected',
          detail:
            `${host}:${port} bağlantısı kabul ediyor.`,
        };
      }

      return {
        key: 'email',
        label: 'E-posta (SMTP)',
        state: 'broken',
        detail:
          `${host}:${port} bağlantısı kabul etmiyor.`,
      };
    } catch {
      return {
        key: 'email',
        label: 'E-posta (SMTP)',
        state: 'broken',
        detail:
          'SMTP sunucusuna ulaşılamadı.',
      };
    }
  }

  /**
   * Checks the actual published website.
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
      const response =
        await fetch(url, {
          method: 'GET',
          signal:
            AbortSignal.timeout(8000),
        });

      if (response.ok) {
        return {
          key: 'website',
          label: 'Web Sitesi',
          state: 'connected',
          detail:
            `${url} HTTP ${response.status} yanıtı veriyor.`,
        };
      }

      return {
        key: 'website',
        label: 'Web Sitesi',
        state: 'broken',
        detail:
          `${url} → HTTP ${response.status}. Site ziyaretçiye başarılı yanıt vermiyor.`,
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
 * Reads the actual TLS certificate presented by the host.
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
        tls.connect({
          host,
          port: 443,
          servername: host,
          timeout: 10_000,
        });

      let settled = false;

      const finish = (
        callback: () => void,
      ) => {
        if (settled) {
          return;
        }

        settled = true;
        callback();
      };

      socket.once(
        'secureConnect',
        () => {
          finish(() => {
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
          });
        },
      );

      socket.once(
        'error',
        (err) => {
          finish(() => {
            socket.destroy();
            reject(err);
          });
        },
      );

      socket.once(
        'timeout',
        () => {
          finish(() => {
            socket.destroy();
            reject(
              new Error(
                'TLS bağlantısı zaman aşımına uğradı.',
              ),
            );
          });
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
        result: boolean,
      ) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(
        timeoutMs,
      );

      socket.once(
        'connect',
        () => done(true),
      );

      socket.once(
        'error',
        () => done(false),
      );

      socket.once(
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

/**
 * Formats dates safely for the readiness panel.
 */
function formatDate(
  value:
    | string
    | undefined,
): string {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return date.toLocaleString(
    'tr-TR',
  );
}
