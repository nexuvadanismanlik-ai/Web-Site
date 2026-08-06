#!/usr/bin/env node
/**
 * The write half of the chain, end to end:
 *
 *   Admin → Kaydet → Taslak → Yayınla → Derleme → Canlı site → Geri al
 *
 * Puts a marker in the hero badge, proves the published site does NOT change
 * on save, publishes, waits for the rebuild to reach visitors, then restores
 * the original text and publishes again.
 *
 * WRITES AND PUBLISHES TWICE. The site ends where it started, but the marker
 * is live for the minute or two the first rebuild takes, and both publishes
 * are recorded in the publish history — audit data, never deleted.
 *
 *   VERIFY_ADMIN_EMAIL=... VERIFY_ADMIN_PASSWORD=... node scripts/verify-publish.mjs
 *
 * Targets default to the deployed services; override with VERIFY_API_URL and
 * VERIFY_SITE_URL.
 */
const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const SITE = (
  process.env.VERIFY_SITE_URL ?? 'https://nexuva-web-site-frontend.onrender.com'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL;
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD;

const MARKER = `zincir-${Date.now().toString(36)}`;
let failures = 0;

function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'HATA'}  ${name}${detail ? ` — ${detail}` : ''}`);
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
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(body)?.slice(0, 300)}`);
  return unwrap(body);
}

async function badgeOnSite() {
  const res = await fetch(`${SITE}/?cachebust=${Date.now()}`, { cache: 'no-store' });
  return res.ok ? await res.text() : '';
}

const login = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const auth = { Authorization: `Bearer ${login.accessToken}` };
console.log(`Giriş: ${login.user.email}\n`);

const section = await call('/website/sections/hero', { headers: auth });
const original = JSON.parse(JSON.stringify(section.data));
const originalBadge = original.badge?.tr ?? '';
console.log(`Mevcut rozet: "${originalBadge}"\n`);

async function setBadge(text) {
  await call('/website/sections/hero', {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ ...original, badge: { tr: text, en: text } }),
  });
}

try {
  // ── 1. Save moves the draft only ──────────────────────────────────────────
  await setBadge(MARKER);
  const draft = await call('/website/content?state=draft');
  const published = await call('/website/content');
  check('1. Kaydetmek taslağı değiştiriyor', draft.hero?.badge?.tr === MARKER, draft.hero?.badge?.tr);
  check(
    '2. Kaydetmek yayındaki içeriği DEĞİŞTİRMİYOR',
    published.hero?.badge?.tr !== MARKER,
    `yayında hâlâ "${published.hero?.badge?.tr}"`,
  );

  const siteBeforePublish = await badgeOnSite();
  check('3. Site de değişmedi', !siteBeforePublish.includes(MARKER), 'yayınlanmadan görünmüyor');

  // ── 2. Publish ────────────────────────────────────────────────────────────
  const result = await call('/website/publish', { method: 'POST', headers: auth });
  check('4. Yayınlama bir sürüm dondurdu', typeof result.version === 'number', `sürüm ${result.version}`);
  check('5. Yayınlama derlemeyi tetikledi', result.state !== 'FAILED', `${result.state} · ${result.detail}`);

  const afterPublish = await call('/website/content');
  check('6. API artık yeni sürümü sunuyor', afterPublish.hero?.badge?.tr === MARKER, afterPublish.hero?.badge?.tr);

  // ── 3. Wait for the rebuild to reach visitors ─────────────────────────────
  console.log('\nSitenin yeniden derlenmesi bekleniyor (en fazla 10 dk)...');
  const deadline = Date.now() + 10 * 60 * 1000;
  let live = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 20_000));
    const html = await badgeOnSite();
    if (html.includes(MARKER)) {
      live = true;
      break;
    }
    process.stdout.write('.');
  }
  console.log('');
  check('7. Değişiklik CANLI SİTEDE görünüyor', live, live ? MARKER : '10 dakikada gelmedi');
} finally {
  // ── 4. Put it back ────────────────────────────────────────────────────────
  console.log('\nEski metin geri yükleniyor...');
  await setBadge(originalBadge);
  const restored = await call('/website/publish', { method: 'POST', headers: auth });
  console.log(`Geri alındı ve yayınlandı — sürüm ${restored.version}`);
}

console.log(`\n${failures === 0 ? 'ZİNCİR TAM ÇALIŞIYOR' : `${failures} kontrol başarısız`}`);
process.exit(failures > 0 ? 1 : 0);
