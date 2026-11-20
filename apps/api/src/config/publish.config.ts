import { registerAs } from '@nestjs/config';

/**
 * How edited content reaches the public website.
 *
 * The website runs on Vercel as a Next.js app with ISR, so publishing is a
 * cache invalidation — strategy `revalidate`. `deploy-hook` remains for a
 * host that has to rebuild (any provider's deploy hook URL); it is not needed
 * on Vercel.
 *
 * Either way, a publish only counts as done once the live site is read back
 * and found to serve the new content version (publish-verification.ts). That
 * check needs SITE_URL; without it the outcome is recorded as unverified.
 */
export const publishConfig = registerAs('publish', () => ({
  /** 'revalidate' | 'deploy-hook' | 'none' */
  strategy: process.env.PUBLISH_STRATEGY ?? 'none',

  /** Next.js revalidation endpoint and its shared secret (strategy: revalidate). */
  revalidateUrl: process.env.FRONTEND_REVALIDATE_URL ?? '',
  revalidateSecret: process.env.FRONTEND_REVALIDATE_SECRET ?? '',

  /**
   * Deploy hook URL (strategy: deploy-hook). RENDER_DEPLOY_HOOK_URL is still
   * read so the Render services keep publishing until they are switched off;
   * remove it with them.
   */
  deployHookUrl: process.env.DEPLOY_HOOK_URL ?? process.env.RENDER_DEPLOY_HOOK_URL ?? '',

  /** Where the published site is served — the page read back to verify a publish. */
  siteUrl: process.env.SITE_URL ?? '',

  /** How patiently the verification reads the site back after a revalidation. */
  verifyAttempts: positiveInt(process.env.PUBLISH_VERIFY_ATTEMPTS, 6),
  verifyDelayMs: positiveInt(process.env.PUBLISH_VERIFY_DELAY_MS, 2_000),

  /**
   * IndexNow key (https://www.indexnow.org). When set, a verified publish tells
   * Bing and the other IndexNow engines which pages changed. The site serves
   * the same key at /indexnow-key.txt so the engines can confirm ownership.
   */
  indexNowKey: process.env.INDEXNOW_KEY ?? '',
}));

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
