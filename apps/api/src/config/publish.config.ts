import { registerAs } from '@nestjs/config';

/**
 * How edited content reaches the public website.
 *
 * The website is currently a static export on a Render Static Site, which has
 * no runtime, so publishing means rebuilding — strategy `deploy-hook`. When the
 * frontend moves to a Render Web Service running Next.js with ISR, publishing
 * becomes a cache invalidation instead — strategy `revalidate`.
 *
 * That migration is meant to be a configuration change, not a code change:
 * both strategies live behind the same PublishService.
 */
export const publishConfig = registerAs('publish', () => ({
  /** 'deploy-hook' | 'revalidate' | 'none' */
  strategy: process.env.PUBLISH_STRATEGY ?? 'none',

  /** Render Deploy Hook URL for the website service (strategy: deploy-hook). */
  deployHookUrl: process.env.RENDER_DEPLOY_HOOK_URL ?? '',

  /** Next.js revalidation endpoint (strategy: revalidate). */
  revalidateUrl: process.env.FRONTEND_REVALIDATE_URL ?? '',
  revalidateSecret: process.env.FRONTEND_REVALIDATE_SECRET ?? '',

  /**
   * Credentials for reading back how a triggered build ended.
   *
   * The deploy hook answers the moment the build is queued, so without these
   * the panel can only report that a rebuild was requested — a build that fails
   * would leave the site stale with nothing on screen to say so. With them, the
   * deploy is polled and the publish record settles on SUCCEEDED or FAILED.
   */
  renderApiKey: process.env.RENDER_API_KEY ?? '',
  renderServiceId: process.env.RENDER_FRONTEND_SERVICE_ID ?? '',

  // PUBLISH_AUTO and PUBLISH_DEBOUNCE_MS are gone. Publishing now freezes a
  // content version, so an automatic publish would mint a version and trigger a
  // build on every save — and the point of the draft/published split is that
  // saving and publishing are different acts.
}));
