import { promises as fs } from 'fs';
import path from 'path';
import type { SiteContent } from '@nexuva/types';

/**
 * Shared content store lives at the repo root (`content/site.json`) so that the
 * admin panel and the public website read/write the exact same data with no
 * database required. When running `next dev`, cwd is the app directory
 * (apps/web), so the repo root is two levels up.
 */
const CONTENT_PATH = path.join(process.cwd(), '..', '..', 'content', 'site.json');

export async function getSiteContent(): Promise<SiteContent> {
  const raw = await fs.readFile(CONTENT_PATH, 'utf-8');
  return JSON.parse(raw) as SiteContent;
}
