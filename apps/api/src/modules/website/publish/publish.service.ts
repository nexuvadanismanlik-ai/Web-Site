import { Injectable, Logger, BadRequestException, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';

export type PublishStrategy = 'deploy-hook' | 'revalidate' | 'none';

/** Mirrors the PublishState enum in the schema. */
export type PublishState = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface PublishResult {
  ok: boolean;
  strategy: PublishStrategy;
  at: string;
  detail: string;
  /** PENDING while a triggered build is still running. */
  state: PublishState;
  id: string | null;
  actor: string | null;
}

export interface PublishStatus {
  strategy: PublishStrategy;
  configured: boolean;
  autoPublish: boolean;
  /** True when edits have been made that no publish has carried to the site. */
  pendingChanges: boolean;
  lastChangeAt: string | null;
  lastPublish: PublishResult | null;
  /** True when a build is in flight, so the panel can say "yayınlanıyor". */
  publishInProgress: boolean;
  /** False when the deploy result cannot be read back — outcomes stay unknown. */
  outcomeTracking: boolean;
  history: PublishResult[];
}

/** How many past attempts the status endpoint carries. */
const HISTORY_LIMIT = 10;

/** A build that has not settled within this is treated as lost, not running. */
const DEPLOY_TIMEOUT_MS = 30 * 60_000;

/** Render deploy statuses that mean the build finished successfully. */
const RENDER_SUCCESS = new Set(['live', 'deactivated']);
/** Render deploy statuses that mean it will never go live. */
const RENDER_FAILURE = new Set([
  'build_failed',
  'update_failed',
  'canceled',
  'pre_deploy_failed',
]);

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
 * Every attempt is written to PublishLog before anything else happens, so the
 * record survives the restart that a deploy itself often causes. State that
 * used to live in fields on this class vanished on every redeploy.
 *
 * Publishing never blocks a content write: failures are logged and surfaced
 * through getStatus() rather than thrown into the editor's save.
 */
@Injectable()
export class PublishService implements OnModuleDestroy {
  private readonly logger = new Logger(PublishService.name);

  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenants: WebsiteTenantService,
  ) {}

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  // ─── Public surface ───────────────────────────────────────────────────────

  /**
   * Records that content changed. Schedules a publish when auto-publish is on;
   * otherwise the change simply shows as pending until someone publishes.
   *
   * Deliberately not awaited by callers: a save must not fail because the
   * bookkeeping write did.
   */
  contentChanged(tenantId: string): void {
    void this.prisma.websiteState
      .upsert({
        where: { tenantId },
        create: { tenantId, lastContentChangeAt: new Date() },
        update: { lastContentChangeAt: new Date() },
      })
      .catch((err: unknown) => {
        this.logger.error(`Could not record content change: ${String(err)}`);
      });

    if (!this.autoPublish) return;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.publish(null).catch(() => undefined);
    }, this.debounceMs);
  }

  /** Publishes immediately. Used by the admin's Publish action. */
  async publish(actorId: string | null, tenantSlug?: string): Promise<PublishResult> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const strategy = this.strategy;

    if (strategy === 'none') {
      return this.write(tenantId, actorId, strategy, {
        state: 'FAILED',
        detail:
          'No publish strategy configured. Set PUBLISH_STRATEGY to deploy-hook or revalidate.',
      });
    }

    try {
      if (strategy === 'revalidate') {
        const detail = await this.triggerRevalidate();
        // Revalidation is synchronous: if the call returned, the site is updated.
        return this.write(tenantId, actorId, strategy, { state: 'SUCCEEDED', detail });
      }

      const { deployId, detail } = await this.triggerDeployHook();
      // The hook returns once the build is queued, not once it is live, so the
      // record stays PENDING until the deploy is read back.
      return this.write(tenantId, actorId, strategy, {
        state: this.canTrackOutcome && deployId ? 'PENDING' : 'SUCCEEDED',
        detail,
        deployId,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Publish failed (${strategy}): ${detail}`);
      return this.write(tenantId, actorId, strategy, { state: 'FAILED', detail });
    }
  }

  async getStatus(tenantSlug?: string): Promise<PublishStatus> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);

    // Settle anything still in flight before reporting, so the panel never
    // shows "yayınlanıyor" for a build that finished long ago.
    await this.settlePending(tenantId);

    const [state, rows, lastSuccess] = await Promise.all([
      this.prisma.websiteState.findUnique({ where: { tenantId } }),
      this.prisma.publishLog.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        take: HISTORY_LIMIT,
        include: { actor: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.publishLog.findFirst({
        where: { tenantId, state: 'SUCCEEDED' },
        orderBy: { startedAt: 'desc' },
        select: { finishedAt: true, startedAt: true },
      }),
    ]);

    const history = rows.map((row) => this.toResult(row));
    const lastChangeAt = state?.lastContentChangeAt ?? null;
    const publishedAt = lastSuccess?.finishedAt ?? lastSuccess?.startedAt ?? null;

    return {
      strategy: this.strategy,
      configured: this.isConfigured(),
      autoPublish: this.autoPublish,
      pendingChanges:
        lastChangeAt !== null && (publishedAt === null || lastChangeAt > publishedAt),
      lastChangeAt: lastChangeAt?.toISOString() ?? null,
      lastPublish: history[0] ?? null,
      publishInProgress: history.some((h) => h.state === 'PENDING'),
      outcomeTracking: this.canTrackOutcome,
      history,
    };
  }

  // ─── Strategies ───────────────────────────────────────────────────────────

  private async triggerDeployHook(): Promise<{ deployId: string | null; detail: string }> {
    const url = this.config.get<string>('publish.deployHookUrl') ?? '';
    if (!url) {
      throw new BadRequestException('RENDER_DEPLOY_HOOK_URL is not set');
    }

    const res = await this.post(url);
    if (!res.ok) {
      throw new Error(`Deploy hook responded with HTTP ${res.status}`);
    }

    const deployId = await this.readDeployId(res);
    return {
      deployId,
      detail: deployId
        ? 'Rebuild triggered; the site updates when the deploy finishes (usually a few minutes).'
        : 'Rebuild triggered. The deploy id was not returned, so the outcome cannot be tracked.',
    };
  }

  /** Render's hook answers with `{"deploy":{"id":"dep-..."}}`. */
  private async readDeployId(res: Response): Promise<string | null> {
    try {
      const body = (await res.json()) as { deploy?: { id?: unknown } };
      const id = body.deploy?.id;
      return typeof id === 'string' && id ? id : null;
    } catch {
      return null;
    }
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

  // ─── Deploy outcome ───────────────────────────────────────────────────────

  /** Resolves every PENDING record for this tenant against the deploy provider. */
  private async settlePending(tenantId: string): Promise<void> {
    const pending = await this.prisma.publishLog.findMany({
      where: { tenantId, state: 'PENDING' },
      orderBy: { startedAt: 'desc' },
      take: 5,
    });
    if (pending.length === 0) return;

    await Promise.all(
      pending.map(async (row) => {
        const outcome = await this.deployOutcome(row.deployId);

        if (outcome === 'PENDING') {
          // A build that never reported back would otherwise sit as "in
          // progress" forever and keep the panel from ever looking settled.
          if (Date.now() - row.startedAt.getTime() < DEPLOY_TIMEOUT_MS) return;
          await this.prisma.publishLog.update({
            where: { id: row.id },
            data: {
              state: 'FAILED',
              finishedAt: new Date(),
              detail: 'Deploy did not report a result within 30 minutes.',
            },
          });
          return;
        }

        await this.prisma.publishLog.update({
          where: { id: row.id },
          data: {
            state: outcome,
            finishedAt: new Date(),
            detail:
              outcome === 'SUCCEEDED'
                ? 'Deploy finished; the published site now carries these changes.'
                : 'Deploy failed. The site still shows the previously published content.',
          },
        });
      }),
    );
  }

  private async deployOutcome(deployId: string | null): Promise<PublishState> {
    if (!deployId || !this.canTrackOutcome) return 'PENDING';

    const apiKey = this.config.get<string>('publish.renderApiKey') ?? '';
    const serviceId = this.config.get<string>('publish.renderServiceId') ?? '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let res: Response;
      try {
        res = await fetch(
          `https://api.render.com/v1/services/${serviceId}/deploys/${deployId}`,
          {
            headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
            signal: controller.signal,
          },
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        this.logger.warn(`Deploy status lookup returned HTTP ${res.status}`);
        return 'PENDING';
      }

      const body = (await res.json()) as { status?: unknown };
      const status = typeof body.status === 'string' ? body.status : '';
      if (RENDER_SUCCESS.has(status)) return 'SUCCEEDED';
      if (RENDER_FAILURE.has(status)) return 'FAILED';
      return 'PENDING';
    } catch (err) {
      // Unreachable provider is not a failed deploy — leave it pending.
      this.logger.warn(`Deploy status lookup failed: ${String(err)}`);
      return 'PENDING';
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

  /** Whether a triggered build's result can be read back afterwards. */
  private get canTrackOutcome(): boolean {
    return (
      !!this.config.get<string>('publish.renderApiKey') &&
      !!this.config.get<string>('publish.renderServiceId')
    );
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

  private async write(
    tenantId: string,
    actorId: string | null,
    strategy: PublishStrategy,
    fields: { state: PublishState; detail: string; deployId?: string | null },
  ): Promise<PublishResult> {
    const settled = fields.state !== 'PENDING';
    const row = await this.prisma.publishLog.create({
      data: {
        tenantId,
        actorId,
        strategy,
        state: fields.state,
        detail: fields.detail,
        deployId: fields.deployId ?? null,
        finishedAt: settled ? new Date() : null,
      },
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
    });

    if (fields.state === 'FAILED') {
      this.logger.error(`Publish failed (${strategy}): ${fields.detail}`);
    } else {
      this.logger.log(`Publish ${fields.state.toLowerCase()} via ${strategy}: ${fields.detail}`);
    }

    return this.toResult(row);
  }

  private toResult(row: {
    id: string;
    strategy: string;
    state: string;
    detail: string;
    startedAt: Date;
    finishedAt: Date | null;
    actor?: { firstName: string | null; lastName: string | null; email: string } | null;
  }): PublishResult {
    const state = row.state as PublishState;
    const name = row.actor
      ? [row.actor.firstName, row.actor.lastName].filter(Boolean).join(' ') || row.actor.email
      : null;

    return {
      // Kept for the existing admin client, which reads `ok` to decide whether
      // the action succeeded. A build still running is not yet a failure.
      ok: state !== 'FAILED',
      strategy: (row.strategy === 'deploy-hook' || row.strategy === 'revalidate'
        ? row.strategy
        : 'none') as PublishStrategy,
      at: (row.finishedAt ?? row.startedAt).toISOString(),
      detail: row.detail,
      state,
      id: row.id,
      actor: name,
    };
  }
}
