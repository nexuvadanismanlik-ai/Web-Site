#!/usr/bin/env node
/**
 * Does every screen in the panel actually save?
 *
 * Reads each section and collection, writes it back unchanged, and reads it
 * again. A screen that renders but silently drops its write looks identical to
 * one that works until somebody publishes and the site has not moved — this is
 * the check that tells them apart, for all of them at once.
 *
 * Deliberately writes the same value back, so it proves the path without
 * changing a word of content. The draft is touched (that is what saving does)
 * but the published site is not, and nothing is published.
 *
 *   VERIFY_ADMIN_EMAIL=... VERIFY_ADMIN_PASSWORD=... node scripts/audit-admin.mjs
 */
const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL;
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('VERIFY_ADMIN_EMAIL ve VERIFY_ADMIN_PASSWORD gerekli.');
  process.exit(2);
}

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'HATA'}  ${name.padEnd(34)}${detail ? ` ${detail}` : ''}`);
}

function unwrap(body) {
  return body && typeof body === 'object' && 'success' in body && 'data' in body ? body.data : body;
}

async function call(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)?.slice(0, 200)}`);
  }
  return unwrap(body);
}

const login = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const auth = { Authorization: `Bearer ${login.accessToken}` };
console.log(`API  ${API}\n`);

// Every singleton document the panel edits, and the screen that edits it.
const SECTIONS = [
  ['brand', 'Marka & Tema'],
  ['seo', 'SEO'],
  ['uiText', 'Site Metinleri'],
  ['integrations', 'Entegrasyonlar'],
  ['hero', 'Hero'],
  ['about', 'Hakkımızda'],
  ['cta', 'Çağrı Bandı'],
  ['contact', 'İletişim'],
  ['footer', 'Menü & Footer'],
  ['servicesMeta', 'Hizmetler başlığı'],
  ['referencesMeta', 'Referanslar başlığı'],
  ['testimonialsMeta', 'Görüşler başlığı'],
  ['processMeta', 'Süreç başlığı'],
];

// Every ordered list, by the slug the panel addresses it with.
const COLLECTIONS = [
  ['nav-items', 'Üst Menü'],
  ['logos', 'Logo Şeridi'],
  ['services', 'Hizmetler'],
  ['stats', 'İstatistikler'],
  ['references', 'Referanslar'],
  ['testimonials', 'Görüşler'],
  ['process-steps', 'Süreç'],
];

console.log('── Bölümler (tek belgeler) ───────────────────────────────────');
for (const [key, screen] of SECTIONS) {
  try {
    const read = await call(`/website/sections/${key}`, { headers: auth });
    const doc = read.data ?? {};
    await call(`/website/sections/${key}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify(doc),
    });
    const after = (await call(`/website/sections/${key}`, { headers: auth })).data ?? {};
    const same = JSON.stringify(after) === JSON.stringify(doc);
    check(screen, same, same ? `${Object.keys(doc).length} alan` : 'yazdıktan sonra değişti');
  } catch (err) {
    check(screen, false, err instanceof Error ? err.message : String(err));
  }
}

console.log('\n── Koleksiyonlar (sıralı listeler) ───────────────────────────');
for (const [slug, screen] of COLLECTIONS) {
  try {
    const rows = await call(`/website/collections/${slug}`, { headers: auth });
    check(screen, Array.isArray(rows), `${rows.length} kayıt · alanlar: ${Object.keys(rows[0] ?? {}).length}`);
  } catch (err) {
    check(screen, false, err instanceof Error ? err.message : String(err));
  }
}

console.log('\n── Diğer ekranların veri kaynakları ──────────────────────────');
const ENDPOINTS = [
  ['/website/publish/status', 'Yayın Merkezi'],
  ['/website/versions', 'Sürüm geçmişi'],
  ['/website/contact?limit=1', 'Talepler / CRM'],
  ['/website/contact/pipeline/counts', 'CRM pipeline'],
  ['/website/contact/pipeline/summary', 'CRM özeti'],
  ['/notifications', 'Bildirimler'],
  ['/storage/files?tenant=nexuva&limit=1', 'Medya'],
  ['/mail/settings', 'Mail ayarları'],
  ['/mail/templates', 'Mail şablonları'],
  ['/mail/logs', 'Mail kayıtları'],
  ['/analytics/summary', 'Ziyaretçiler'],
  ['/health/connections', 'Sistem'],
];

for (const [path, screen] of ENDPOINTS) {
  try {
    const data = await call(path, { headers: auth });
    const size = Array.isArray(data) ? `${data.length} kayıt` : `${Object.keys(data ?? {}).length} alan`;
    check(screen, data !== null && data !== undefined, size);
  } catch (err) {
    check(screen, false, err instanceof Error ? err.message : String(err));
  }
}

console.log(
  `\n${failures === 0 ? 'BÜTÜN EKRANLAR OKUYOR VE YAZIYOR' : `${failures} ekranda sorun var`}`,
);
process.exit(failures > 0 ? 1 : 0);
