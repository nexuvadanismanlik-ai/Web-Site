import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Tells IndexNow-enabled search engines (Bing, Yandex, Seznam, Naver…) that the
 * site changed, after a publish is verified.
 *
 * Bing matters beyond Bing: ChatGPT search and Copilot draw heavily on its
 * index, so a page Bing has not re-crawled is a page those assistants describe
 * from an older copy.
 *
 * Content is site-wide (one document feeds every page), so the main pages are
 * submitted together. The key is shared with the site, which serves it at
 * /indexnow-key.txt for the engines to verify ownership.
 *
 * Best effort by design: bounded by a short timeout, never throws, and a
 * failure is only logged — it must not turn a successful publish into a
 * failed one.
 */
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const PATHS = ['/', '/services/', '/logiops/', '/about/', '/references/', '/contact/'];
const KEY_FORMAT = /^[a-zA-Z0-9-]{8,128}$/;
const TIMEOUT_MS = 3_000;

@Injectable()
export class IndexNowService {
  private readonly logger = new Logger(IndexNowService.name);

  constructor(private readonly config: ConfigService) {}

  async notifyChangedSite(): Promise<void> {
    const key = this.config.get<string>('publish.indexNowKey') ?? '';
    const siteUrl = this.config.get<string>('publish.siteUrl') ?? '';
    if (!key || !siteUrl) return;
    if (!KEY_FORMAT.test(key)) {
      this.logger.warn('INDEXNOW_KEY has an invalid format; IndexNow notification skipped.');
      return;
    }

    let origin: URL;
    try {
      origin = new URL(siteUrl);
    } catch {
      this.logger.warn('SITE_URL is not a valid URL; IndexNow notification skipped.');
      return;
    }

    const body = buildIndexNowPayload(origin, key, PATHS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      // 200 and 202 are both acceptance.
      if (res.status === 200 || res.status === 202) {
        this.logger.log(`IndexNow accepted ${body.urlList.length} URLs.`);
      } else {
        this.logger.warn(`IndexNow responded with HTTP ${res.status}.`);
      }
    } catch (err) {
      this.logger.warn(`IndexNow notification failed: ${String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function buildIndexNowPayload(origin: URL, key: string, paths: string[]) {
  return {
    host: origin.host,
    key,
    keyLocation: `${origin.origin}/indexnow-key.txt`,
    urlList: paths.map((path) => `${origin.origin}${path}`),
  };
}
