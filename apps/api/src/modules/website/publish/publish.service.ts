import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebsiteTenantService } from '../website-tenant.service';
import { WebsiteStateService } from '../website-state.service';
import { ContentVersionService } from '../versions/content-version.service';
import { describeOutcome, verifySiteVersion } from './publish-verification';
import { IndexNowService } from './indexnow.service';

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
  /** Content version this publish carried, once one was frozen. */
  version: number | null;

  /** When the attempt began. Distinct from "at", which is when it settled. */
  startedAt: string;
  /** Null while a build is still running. */
  finishedAt: string | null;
  /**
   * How long the whole publish took, in milliseconds. Null while running.
   *
   * Reported because "the site has not changed yet" and "the build is still
   * going" look identical from the panel, and telling them apart is the first
   * thing anybody wants.
   */
  durationMs: number | null;
  /** Identifier from the deploy provider, for looking the build up directly. */
  deployId: string | null;
}

export interface PublishStatus {
  strategy: PublishStrategy;
  configured: boolean;
  /** True when edits have been made that no publish has carried to the site. */
  pendingChanges: boolean;
  lastChangeAt: string | null;
  lastPublish: PublishResult | null;
  /** True when a build is in flight, so the panel can say "yayınlanıyor". */
  publishInProgress: boolean;
  /** False when the live site cannot be read back (no SITE_URL) — outcomes stay unverified. */
  outcomeTracking: boolean;
  history: PublishResult[];
}

/** How many past attempts the status endpoint carries. */
const HISTORY_LIMIT = 10;

/** A build that has not settled within this is treated as lost, not running. */
const DEPLOY_TIMEOUT_MS = 30 * 60_000;

/** Per-read timeout when checking what the live site serves. */
const VERIFY_TIMEOUT_MS = 8_000;

/**
 * Carries edited content to the public website.
 *
 *   revalidate   Calls the site's revalidation endpoint so Next.js regenerates
 *                the pages on the next request. Seconds, no deploy. The
 *                strategy for the Vercel site.
 *
 *   deploy-hook  Triggers a rebuild through a provider's deploy hook. Only for
 *                a host that has to rebuild; minutes.
 *
 * Neither counts as success on the strength of an HTTP 200. After the call,
 * the live home page is read back and must declare the new content version
 * (publish-verification.ts). A revalidation is verified in the same request;
 * a rebuild stays PENDING and is verified when the status is next read.
 *
 * Every attempt is written to PublishLog before anything else happens, so the
 * record survives the restart that a deploy itself often causes. State that
 * used to live in fields on this class vanished on every redeploy.
 *
 * Publishing never blocks a content write: failures are logged and surfaced
 * through getStatus() rather than thrown into the editor's save.
 */
@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenants: WebsiteTenantService,
    private readonly state: WebsiteStateService,
    private readonly versions: ContentVersionService,
    private readonly indexNow: IndexNowService,
  ) {}

  // ─── Public surface ───────────────────────────────────────────────────────

  /** Publishes immediately. Used by the admin's Publish action. */
  async publish(
    actorId: string | null,
    tenantSlug?: string,
    note?: string | null,
  ): Promise<PublishResult> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);
    const strategy = this.strategy;

    // Freeze first, whatever the strategy. The version is what "published"
    // means — it is the document the API serves from that moment on. The deploy
    // is only how a statically built site finds out. Refusing to freeze because
    // no deploy hook is configured would conflate the two, and would leave the
    // API with nothing to serve.
    let version: number;
    try {
      const committed = await this.versions.publishDraft(actorId, note ?? null, tenantSlug);
      version = committed.number;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Could not freeze a content version: ${detail}`);
      return this.write(tenantId, actorId, strategy, {
        state: 'FAILED',
        detail: `İçerik sürümü alınamadı, yayın durduruldu: ${detail}`,
      });
    }

    if (strategy === 'none') {
      // The content is published; the site cannot be told. Recorded as a
      // failure so the panel says so instead of implying visitors will see it.
      return this.write(tenantId, actorId, strategy, {
        state: 'FAILED',
        detail:
          `Sürüm ${version} yayınlandı, ancak site yeniden derlenemedi: ` +
          'PUBLISH_STRATEGY tanımlı değil.',
        version,
      });
    }

    try {
      if (strategy === 'revalidate') {
        await this.triggerRevalidate();
        // The endpoint answered; now prove the site serves the new version.
        const verdict = await this.verify(version);
        const result = await this.write(tenantId, actorId, strategy, {
          state: verdict.ok ? 'SUCCEEDED' : 'FAILED',
          detail: `Sürüm ${version}: önbellek yenilendi. ${verdict.detail}`,
          version,
        });
        if (verdict.ok) await this.indexNow.notifyChangedSite();
        return result;
      }

      const { deployId } = await this.triggerDeployHook();
      // The hook returns once the build is queued, not once it is live, so the
      // record stays PENDING until the live site is read back.
      return this.write(tenantId, actorId, strategy, {
        state: this.canTrackOutcome ? 'PENDING' : 'FAILED',
        detail: this.canTrackOutcome
          ? `Sürüm ${version} alındı; derleme başlatıldı. Site yeni sürümü sunduğunda yayın tamamlanmış sayılacak.`
          : `Sürüm ${version} alındı ve derleme başlatıldı, ancak SITE_URL tanımlı olmadığı için sitede göründüğü doğrulanamayacak.`,
        deployId,
        version,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Publish failed (${strategy}): ${detail}`);
      return this.write(tenantId, actorId, strategy, { state: 'FAILED', detail, version });
    }
  }

  async getStatus(tenantSlug?: string): Promise<PublishStatus> {
    const tenantId = await this.tenants.resolveTenantId(tenantSlug);

    // Settle anything still in flight before reporting, so the panel never
    // shows "yayınlanıyor" for a build that finished long ago.
    await this.settlePending(tenantId);

    const [lastChangeAt, rows, lastSuccess] = await Promise.all([
      this.state.lastContentChangeAt(tenantId),
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
    const publishedAt = lastSuccess?.finishedAt ?? lastSuccess?.startedAt ?? null;

    return {
      strategy: this.strategy,
      configured: this.isConfigured(),
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

  private async triggerDeployHook(): Promise<{ deployId: string | null }> {
    const url = this.config.get<string>('publish.deployHookUrl') ?? '';
    if (!url) {
      throw new BadRequestException('DEPLOY_HOOK_URL is not set');
    }

    const res = await this.post(url);
    if (!res.ok) {
      throw new Error(`Deploy hook responded with HTTP ${res.status}`);
    }

    return { deployId: await this.readDeployId(res) };
  }

  /**
   * The provider's id for the triggered build, kept for reference only.
   * Vercel answers `{"job":{"id":…}}`; Render answered `{"deploy":{"id":…}}`.
   * Nothing depends on it: the outcome is read from the site itself.
   */
  private async readDeployId(res: Response): Promise<string | null> {
    try {
      const body = (await res.json()) as { job?: { id?: unknown }; deploy?: { id?: unknown } };
      const id = body.job?.id ?? body.deploy?.id;
      return typeof id === 'string' && id ? id : null;
    } catch {
      return null;
    }
  }

  private async triggerRevalidate(): Promise<void> {
    const url = this.config.get<string>('publish.revalidateUrl') ?? '';
    const secret = this.config.get<string>('publish.revalidateSecret') ?? '';
    if (!url) throw new BadRequestException('FRONTEND_REVALIDATE_URL is not set');
    if (!secret) throw new BadRequestException('FRONTEND_REVALIDATE_SECRET is not set');

    const res = await this.post(url, {
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ tags: ['site-content'] }),
    });
    if (!res.ok) {
      throw new Error(`Site yenileme uç noktası HTTP ${res.status} döndürdü; yayın siteye ulaşmadı.`);
    }
  }

  /**
   * Whether the live site serves `version`. Never throws: an unverifiable
   * publish is a failed publish with a reason, not an exception.
   */
  private async verify(version: number): Promise<{ ok: boolean; detail: string }> {
    const siteUrl = this.config.get<string>('publish.siteUrl') ?? '';
    if (!siteUrl) {
      return {
        ok: false,
        detail: 'SITE_URL tanımlı değil; yayının sitede göründüğü doğrulanamadı.',
      };
    }
    const outcome = await verifySiteVersion(siteUrl, version, {
      attempts: this.config.get<number>('publish.verifyAttempts') ?? 6,
      delayMs: this.config.get<number>('publish.verifyDelayMs') ?? 2_000,
      timeoutMs: VERIFY_TIMEOUT_MS,
    });
    return { ok: outcome.status === 'verified', detail: describeOutcome(outcome, version) };
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
        const outcome = await this.deployOutcome(row.version);

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
                ? `Derleme tamamlandı; site sürüm ${row.version ?? '?'}'i sunuyor (doğrulandı).`
                : 'Derleme başarısız oldu. Site önceki yayınlanmış içeriği göstermeye devam ediyor.',
          },
        });
        if (outcome === 'SUCCEEDED') await this.indexNow.notifyChangedSite();
      }),
    );
  }

  /**
   * A rebuild's outcome, read from the site: SUCCEEDED once it serves the
   * version, otherwise still PENDING (the caller times it out). A single quick
   * read, since this runs whenever the panel asks for status.
   */
  private async deployOutcome(version: number | null): Promise<PublishState> {
    const siteUrl = this.config.get<string>('publish.siteUrl') ?? '';
    if (version === null || !siteUrl) return 'PENDING';
    const outcome = await verifySiteVersion(siteUrl, version, {
      attempts: 1,
      delayMs: 0,
      timeoutMs: VERIFY_TIMEOUT_MS,
    });
    return outcome.status === 'verified' ? 'SUCCEEDED' : 'PENDING';
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private get strategy(): PublishStrategy {
    const raw = this.config.get<string>('publish.strategy') ?? 'none';
    return raw === 'deploy-hook' || raw === 'revalidate' ? raw : 'none';
  }

  /** Whether a publish's result can be read back from the live site. */
  private get canTrackOutcome(): boolean {
    return !!this.config.get<string>('publish.siteUrl');
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
    fields: {
      state: PublishState;
      detail: string;
      deployId?: string | null;
      version?: number | null;
    },
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
        version: fields.version ?? null,
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
    version?: number | null;
    deployId?: string | null;
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
      version: row.version ?? null,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      // Never negative. startedAt is stamped by the database and finishedAt by
      // this process, so a few milliseconds of clock skew between them is
      // normal — and a publish that reports "-1 ms" reads as a bug in
      // everything else on the screen.
      durationMs: row.finishedAt
        ? Math.max(0, row.finishedAt.getTime() - row.startedAt.getTime())
        : null,
      deployId: row.deployId ?? null,
    };
  }
}
