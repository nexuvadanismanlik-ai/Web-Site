import type { SiteContent } from '@nexuva/types';
import rawContent from '../../../content/site.json';

/**
 * Static-export data source: content/site.json is bundled at BUILD TIME via a
 * plain JSON import — no fs access, no Node server at runtime. Content changes
 * ship by rebuilding (git push → Render Static Site redeploy). The admin panel
 * keeps editing the same file locally; Phase 3+ replaces this with Supabase.
 *
 * The async signature is kept so existing call sites (`await getSiteContent()`)
 * stay untouched.
 */
const siteContent = rawContent as unknown as SiteContent;

export async function getSiteContent(): Promise<SiteContent> {
  return siteContent;
}
