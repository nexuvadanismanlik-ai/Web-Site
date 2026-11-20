/**
 * SEO checks against the built site (.next/server/app), run after `next build`
 * with the content fixture:
 *
 *   NEXUVA_CONTENT_FIXTURE=test/fixtures/site-content.json \
 *   NEXT_PUBLIC_SITE_URL=https://nexuva.example pnpm --filter @nexuva/web build
 *   pnpm --filter @nexuva/web run test:build
 *
 * These read the HTML a crawler would receive. They exist because every one of
 * the failures they check for reached production once: canonicals pointing at
 * the old host, inner pages declaring themselves the home page, two robots
 * tags on the 404, and a sitemap full of another domain's URLs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nexuva.example').replace(/\/+$/, '');
const APP = join(process.cwd(), '.next/server/app');
const read = (file) => readFileSync(join(APP, file), 'utf8');

const PAGES = {
  'index.html': '/',
  'about.html': '/about/',
  'services.html': '/services/',
  'references.html': '/references/',
  'contact.html': '/contact/',
  'logiops.html': '/logiops/',
  'services/google-ads.html': '/services/google-ads/',
  'services/seo.html': '/services/seo/',
};

function meta(html, attr, value) {
  const re = new RegExp(`<meta[^>]*${attr}="${value}"[^>]*content="([^"]*)"`, 'g');
  return [...html.matchAll(re)].map((m) => m[1]);
}
function canonical(html) {
  return [...html.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/g)].map((m) => m[1]);
}

test('build output exists', () => {
  assert.ok(existsSync(APP), 'run next build first');
});

test('each page has exactly one canonical, its own', () => {
  for (const [file, path] of Object.entries(PAGES)) {
    const html = read(file);
    assert.deepEqual(canonical(html), [`${ORIGIN}${path}`], file);
  }
});

test('descriptions and titles are unique across pages', () => {
  const descriptions = new Map();
  const titles = new Map();
  for (const file of Object.keys(PAGES)) {
    const html = read(file);
    const [description] = meta(html, 'name', 'description');
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
    assert.ok(description, `${file} has a description`);
    assert.ok(title, `${file} has a title`);
    assert.ok(
      !descriptions.has(description),
      `${file} repeats the description of ${descriptions.get(description)}`,
    );
    assert.ok(!titles.has(title), `${file} repeats the title of ${titles.get(title)}`);
    descriptions.set(description, file);
    titles.set(title, file);
  }
});

test('exactly one H1 per page', () => {
  for (const file of Object.keys(PAGES)) {
    const count = (read(file).match(/<h1[\s>]/g) ?? []).length;
    assert.equal(count, 1, file);
  }
});

test('no page references the old Render site host', () => {
  for (const file of [
    ...Object.keys(PAGES),
    'robots.txt.body',
    'sitemap.xml.body',
    'llms.txt.body',
  ]) {
    assert.ok(!read(file).includes('nexuva-web-site-frontend.onrender.com'), file);
  }
});

test('all JSON-LD blocks parse and carry no raw "<"', () => {
  for (const file of Object.keys(PAGES)) {
    const html = read(file);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length > 0, `${file} has structured data`);
    for (const [, body] of blocks) {
      assert.ok(!body.includes('<'), file);
      JSON.parse(body);
    }
  }
});

test('FAQ markup only where the questions are visible', () => {
  for (const file of Object.keys(PAGES)) {
    const html = read(file);
    if (!html.includes('"FAQPage"')) continue;
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(([, b]) => JSON.parse(b))
      .find((g) => g['@type'] === 'FAQPage');
    for (const q of ld.mainEntity) {
      assert.ok(html.includes(`>${q.name}<`), `${file}: "${q.name}" is marked up but not shown`);
    }
  }
});

test('the 404 page says noindex and nothing else', () => {
  const html = read('_not-found.html');
  const robots = meta(html, 'name', 'robots');
  assert.ok(robots.length >= 1 && robots.every((r) => r.includes('noindex')), robots.join(' | '));
  assert.deepEqual(canonical(html), []);
});

test('sitemap lists every page on this origin, services included', () => {
  const xml = read('sitemap.xml.body');
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  for (const path of Object.values(PAGES)) assert.ok(locs.includes(`${ORIGIN}${path}`), path);
  assert.ok(locs.every((loc) => loc.startsWith(`${ORIGIN}/`)));
  assert.ok(!locs.some((loc) => loc.includes('/logiops/basvuru')), 'noindex page not listed');
});

test('robots.txt points at this sitemap and keeps /api/ out', () => {
  const txt = read('robots.txt.body');
  assert.ok(txt.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));
  assert.ok(/User-Agent: OAI-SearchBot\nAllow: \/\nDisallow: \/api\//.test(txt));
  assert.ok(/User-Agent: Claude-SearchBot/.test(txt));
});

test('pages declare the content version they were rendered from', () => {
  assert.match(read('index.html'), /<meta name="nexuva-content-version" content="\d+"\/>/);
});
