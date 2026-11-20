/**
 * The SEO helpers every page builds its metadata from.
 * Run: pnpm --filter @nexuva/web test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absoluteUrl, isIndexableDeployment, siteOrigin } from '../lib/origin';
import { clampDescription, isProfileUrl, pageMetadata, serializeJsonLd } from '../lib/seo';
import { confirmedAddress, confirmedPhone } from '../lib/verified-facts';
import { serviceSlug, slugify } from '../lib/services';

function withEnv(vars: Record<string, string | undefined>, run: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('origin comes from NEXT_PUBLIC_SITE_URL, never from content', () => {
  withEnv(
    {
      NEXT_PUBLIC_SITE_URL: 'https://nexuva.example/',
      VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app',
    },
    () => {
      assert.equal(siteOrigin(), 'https://nexuva.example');
    },
  );
});

test('origin falls back to the Vercel production host', () => {
  withEnv(
    { NEXT_PUBLIC_SITE_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: 'nexuvatr.vercel.app' },
    () => {
      assert.equal(siteOrigin(), 'https://nexuvatr.vercel.app');
    },
  );
});

test('no origin means no absolute URLs at all', () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: undefined }, () => {
    assert.equal(siteOrigin(), '');
    assert.equal(absoluteUrl('/services'), '');
  });
});

test('absolute URLs end in a slash, except files and the query part', () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: 'https://nexuva.example' }, () => {
    assert.equal(absoluteUrl('/'), 'https://nexuva.example/');
    assert.equal(absoluteUrl('/services'), 'https://nexuva.example/services/');
    assert.equal(absoluteUrl('/services/seo/'), 'https://nexuva.example/services/seo/');
    assert.equal(absoluteUrl('/sitemap.xml'), 'https://nexuva.example/sitemap.xml');
    assert.equal(absoluteUrl('/contact?x=1'), 'https://nexuva.example/contact/?x=1');
  });
});

test('every page gets its own canonical', () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: 'https://nexuva.example', VERCEL_ENV: 'production' }, () => {
    const about = pageMetadata({ path: '/about', title: 'Hakkımızda', description: 'x' });
    const contact = pageMetadata({ path: '/contact', title: 'İletişim', description: 'y' });
    assert.equal(about.alternates?.canonical, 'https://nexuva.example/about/');
    assert.equal(contact.alternates?.canonical, 'https://nexuva.example/contact/');
    assert.equal(about.robots, undefined, 'indexable pages emit no robots tag');
  });
});

test('preview deployments are noindex', () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: 'https://nexuva.example', VERCEL_ENV: 'preview' }, () => {
    assert.equal(isIndexableDeployment(), false);
    const meta = pageMetadata({ path: '/', title: 't', description: 'd' });
    assert.deepEqual(meta.robots, { index: false, follow: true });
  });
});

test('JSON-LD cannot close its script tag', () => {
  const out = serializeJsonLd({ name: '</script><script>alert(1)</script>', amp: 'a & b' });
  assert.ok(!out.includes('<'), 'no raw <');
  assert.ok(!out.includes('>'), 'no raw >');
  assert.deepEqual(JSON.parse(out), { name: '</script><script>alert(1)</script>', amp: 'a & b' });
});

test('placeholder social links are not profiles', () => {
  assert.equal(isProfileUrl('https://linkedin.com'), false);
  assert.equal(isProfileUrl('https://x.com/'), false);
  assert.equal(isProfileUrl('http://linkedin.com/company/nexuva'), false, 'https only');
  assert.equal(isProfileUrl('https://www.linkedin.com/company/nexuva'), true);
});

test('descriptions are clamped at a word boundary', () => {
  const long = 'kelime '.repeat(60);
  const out = clampDescription(long);
  assert.ok(out.length <= 160);
  assert.ok(out.endsWith('…'));
  assert.ok(!out.includes('kelim…'));
});

test('unconfirmed contact facts never reach structured data', () => {
  assert.equal(confirmedPhone('+90 212 555 0100'), undefined);
  assert.equal(confirmedPhone('+90 212 000 0000'), undefined, 'not in the confirmed list');
  assert.equal(confirmedAddress('Levent, 34330 Beşiktaş / İstanbul'), undefined);
});

test('service slugs: agreed addresses and Turkish transliteration', () => {
  const tr = (text: string) => ({ title: { tr: text, en: text } });
  assert.equal(serviceSlug(tr('Google Ads Yönetimi')), 'google-ads');
  assert.equal(serviceSlug(tr('Meta Reklam Yönetimi')), 'meta-ads');
  assert.equal(serviceSlug(tr('Dijital Marka Danışmanlığı')), 'marka-danismanligi');
  assert.equal(serviceSlug(tr('LogiOps Entegrasyonu')), 'logiops-entegrasyonu');
  assert.equal(slugify('Şirket İçi Eğitim & Çözüm'), 'sirket-ici-egitim-ve-cozum');
});
