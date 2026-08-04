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
   * Publish automatically after a content change, instead of waiting for the
   * editor to press Publish. Off by default: a rebuild takes minutes and a
   * burst of edits would queue several.
   */
  auto: process.env.PUBLISH_AUTO === 'true',

  /**
   * Window to coalesce a burst of edits into one publish. Only used when
   * auto-publishing.
   */
  debounceMs: parseInt(process.env.PUBLISH_DEBOUNCE_MS ?? '60000', 10),
}));
