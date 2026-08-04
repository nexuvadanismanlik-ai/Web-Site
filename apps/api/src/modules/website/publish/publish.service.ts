import { Injectable, Logger, BadRequestException, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PublishStrategy = 'deploy-hook' | 'revalidate' | 'none';

export interface PublishResult {
  ok: boolean;
  strategy: PublishStrategy;
  at: string;
  detail: string;
}

export interface PublishStatus {
  strategy: PublishStrategy;
  configured: boolean;
  autoPublish: boolean;
  /** True when edits have been made that no publish has carried to the site. */
  pendingChanges: boolean;
  lastChangeAt: string | null;
  lastPublish: PublishResult | null;
}

/**
 * Carries edited content to the public website.
 *
 * Two strategies behind one interface, so moving the frontend from a static
 * export to a server-rendered deployment is a config change:
 *
 *   deploy-hook  Triggers a Render rebuild. Required while the site is a static
 *                export, because published HTML only changes at build time.
 *                Slow (minutes) — hence the explicit Publish action.
 *
 *   revalidate   Calls the site's revalidation endpoint so Next.js regenerates
 *                the affected pages on the next request. Seconds, no deploy.
 *                This is the target once the site runs as a Web Service.
 *
 * Publishing never blocks a content write: failures are logged and surfaced
 * through getStatus() rather than thrown into the editor's save.
 */
@Injectable()
export class PublishService implements OnModuleDestroy {
  private readonly logger = new Logger(PublishService.name);

  private timer: NodeJS.Timeout | null = null;
  private lastChangeAt: Date | null = null;
  private lastPublishedAt: Date | null = null;
  private lastPublish: PublishResult | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  // ─── Public surface ───────────────────────────────────────────────────────

  /**
   * Records that content changed. Schedules a publish when auto-publish is on;
   * otherwise the change simply shows as pending until someone publishes.
   */
  contentChanged(): void {
    this.lastChangeAt = new Date();
    if (!this.autoPublish) return;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.publish().catch(() => undefined);
    }, this.debounceMs);
  }

  /** Publishes immediately. Used by the admin's Publish action. */
  async publish(): Promise<PublishResult> {
    const strategy = this.strategy;

    if (strategy === 'none') {
      return this.record({
        ok: false,
        strategy,
        at: new Date().toISOString(),
        detail:
          'No publish strategy configured. Set PUBLISH_STRATEGY to deploy-hook or revalidate.',
      });
    }

    try {
      const detail =
        strategy === 'deploy-hook' ? await this.triggerDeployHook() : await this.triggerRevalidate();

      this.lastPublishedAt = new Date();
      return this.record({ ok: true, strategy, at: this.lastPublishedAt.toISOString(), detail });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Publish failed (${strategy}): ${detail}`);
      return this.record({ ok: false, strategy, at: new Date().toISOString(), detail });
    }
  }

  getStatus(): PublishStatus {
    return {
      strategy: this.strategy,
      configured: this.isConfigured(),
      autoPublish: this.autoPublish,
      pendingChanges:
        this.lastChangeAt !== null &&
        (this.lastPublishedAt === null || this.lastChangeAt > this.lastPublishedAt),
      lastChangeAt: this.lastChangeAt?.toISOString() ?? null,
      lastPublish: this.lastPublish,
    };
  }

  // ─── Strategies ───────────────────────────────────────────────────────────

  private async triggerDeployHook(): Promise<string> {
    const url = this.config.get<string>('publish.deployHookUrl') ?? '';
    if (!url) {
      throw new BadRequestException('RENDER_DEPLOY_HOOK_URL is not set');
    }

    const res = await this.post(url);
    if (!res.ok) {
      throw new Error(`Deploy hook responded with HTTP ${res.status}`);
    }
    return 'Rebuild triggered; the site updates when the deploy finishes (usually a few minutes).';
  }

  private async triggerRevalidate(): Promise<string> {
    const url = this.config.get<string>('publish.revalidateUrl') ?? '';
    const secret = this.config.get<string>('publish.revalidateSecret') ?? '';
    if (!url) throw new BadRequestException('FRONTEND_REVALIDATE_URL is not set');
    if (!secret) throw new BadRequestException('FRONTEND_REVALIDATE_SECRET is not set');

    const res = await this.post(url, {
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ tags: ['site-content'] }),
    });
    if (!res.ok) {
      throw new Error(`Revalidation endpoint responded with HTTP ${res.status}`);
    }
    return 'Site content cache invalidated; the next visitor sees the update.';
  }

  private async post(url: string, init: RequestInit = {}) {
    // Bounded so a hanging hook cannot pin the request or the timer.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(url, { method: 'POST', ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private get strategy(): PublishStrategy {
    const raw = this.config.get<string>('publish.strategy') ?? 'none';
    return raw === 'deploy-hook' || raw === 'revalidate' ? raw : 'none';
  }

  private get autoPublish(): boolean {
    return this.config.get<boolean>('publish.auto') === true;
  }

  private get debounceMs(): number {
    const value = this.config.get<number>('publish.debounceMs');
    return typeof value === 'number' && value > 0 ? value : 60_000;
  }

  private isConfigured(): boolean {
    const strategy = this.strategy;
    if (strategy === 'deploy-hook') return !!this.config.get<string>('publish.deployHookUrl');
    if (strategy === 'revalidate') {
      return (
        !!this.config.get<string>('publish.revalidateUrl') &&
        !!this.config.get<string>('publish.revalidateSecret')
      );
    }
    return false;
  }

  private record(result: PublishResult): PublishResult {
    this.lastPublish = result;
    if (result.ok) {
      this.logger.log(`Published via ${result.strategy}: ${result.detail}`);
    }
    return result;
  }
}
