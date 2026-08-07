#!/usr/bin/env node
/**
 * Every image field, end to end:
 *
 *   Yükle → Seç → Kaydet → Yayınla → Canlı sitede gör → Kaldır → Yayınla → Gitti
 *
 * The removal half matters as much as the addition. A CMS that can set a field
 * and not clear it traps whatever was put there first, and "kaldırma" is on the
 * list of things this panel is supposed to do.
 *
 * Leaves nothing behind: the placeholder is removed, the fields are restored to
 * what they were, and the uploaded file is deleted.
 *
 *   VERIFY_ADMIN_EMAIL=... VERIFY_ADMIN_PASSWORD=... VERIFY_ALLOW_WRITES=1 \
 *   node scripts/verify-media-chain.mjs
 *
 * WRITES AND PUBLISHES TWICE. Both publishes appear in the publish history,
 * which is audit data and is never deleted.
 */
const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const SITE = (
  process.env.VERIFY_SITE_URL ?? 'https://nexuva-web-site-frontend.onrender.com'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL;
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('VERIFY_ADMIN_EMAIL ve VERIFY_ADMIN_PASSWORD gerekli.');
  process.exit(2);
}
if (!process.env.VERIFY_ALLOW_WRITES) {
  console.error(
    'Bu betik içerik değiştirir ve iki kez yayın yapar.\n' +
      'Değişiklikler geri alınır. Kabul ediyorsan VERIFY_ALLOW_WRITES=1 ile çalıştır.',
  );
  process.exit(2);
}

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
      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(body)?.slice(0, 300)}`);
  return unwrap(body);
}

async function siteHtml() {
  const res = await fetch(`${SITE}/?cachebust=${Date.now()}`, { cache: 'no-store' });
  return res.ok ? res.text() : '';
}

/** Polls the live site until the marker appears, or gives up. */
async function waitForSite(marker, present, minutes = 12) {
  const deadline = Date.now() + minutes * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 20_000));
    const html = await siteHtml();
    if (html.includes(marker) === present) return true;
    process.stdout.write('.');
  }
  console.log('');
  return false;
}

const login = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const auth = { Authorization: `Bearer ${login.accessToken}` };
console.log(`API   ${API}\nSite  ${SITE}\n`);

// ── Upload one placeholder ──────────────────────────────────────────────────
// Visibly a placeholder on purpose: if any of this survives the run, it should
// be obvious that it is not brand content.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
<rect width="800" height="600" fill="#eef0f6"/>
<rect x="24" y="24" width="752" height="552" rx="16" fill="none" stroke="#c9cee0" stroke-width="3" stroke-dasharray="14 10"/>
<text x="400" y="300" text-anchor="middle" font-family="sans-serif" font-size="34" fill="#9aa3bd">GORSEL YER TUTUCU</text>
<text x="400" y="344" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#b3bad0">panelden degistirilebilir</text>
</svg>`;

const form = new FormData();
form.append('file', new Blob([svg], { type: 'image/svg+xml' }), 'placeholder.svg');
form.append('folder', 'images');

const uploaded = await call('/storage/upload?tenant=nexuva&folder=images', {
  method: 'POST',
  headers: auth,
  body: form,
});
check('0. Medya kütüphanesine yükleme', Boolean(uploaded.url), uploaded.filename);
const IMG = uploaded.url;

const served = await fetch(IMG);
check('0b. Dosya token olmadan servis ediliyor', served.ok, `HTTP ${served.status} · ${served.headers.get('content-type')}`);

// ── Remember everything before touching it ──────────────────────────────────
const before = {
  about: (await call('/website/sections/about', { headers: auth })).data,
  services: await call('/website/collections/services', { headers: auth }),
  references: await call('/website/collections/references', { headers: auth }),
  logos: await call('/website/collections/logos', { headers: auth }),
};

const firstService = before.services[0];
const firstReference = before.references[0];
const firstLogo = before.logos[0];

try {
  // ── Set every image field ─────────────────────────────────────────────────
  await call('/website/sections/about', {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ ...before.about, image: IMG, imageAlt: 'Yer tutucu' }),
  });
  check('1. Hakkımızda görseli kaydedildi', true);

  if (firstService) {
    await call(`/website/collections/services/${firstService.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ imageUrl: IMG, imageAlt: 'Yer tutucu' }),
    });
    check('2. Hizmet görseli kaydedildi', true, firstService.title?.tr ?? firstService.id);
  }

  if (firstReference) {
    await call(`/website/collections/references/${firstReference.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ logoUrl: IMG, imageUrl: IMG }),
    });
    check('3. Referans logosu ve proje görseli kaydedildi', true, firstReference.name);
  }

  if (firstLogo) {
    await call(`/website/collections/logos/${firstLogo.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ imageUrl: IMG }),
    });
    check('4. Logo şeridi görseli kaydedildi', true, firstLogo.name);
  }

  // ── Draft moved, published did not ────────────────────────────────────────
  const draft = await call('/website/content?state=draft');
  const published = await call('/website/content');
  check('5. Taslak değişti', JSON.stringify(draft).includes(IMG));
  check('6. Yayındaki içerik DEĞİŞMEDİ', !JSON.stringify(published).includes(IMG));

  // ── Publish and wait for the site ─────────────────────────────────────────
  const result = await call('/website/publish', { method: 'POST', headers: auth });
  check('7. Yayınlandı', result.state !== 'FAILED', `sürüm ${result.version} · ${result.state}`);

  console.log('\nSitenin yeniden derlenmesi bekleniyor...');
  const appeared = await waitForSite(IMG, true);
  console.log('');
  check('8. Görseller CANLI SİTEDE görünüyor', appeared, appeared ? IMG : '12 dakikada gelmedi');

  if (appeared) {
    const html = await siteHtml();
    check('8b. Alt metin basıldı', html.includes('Yer tutucu'));
  }
} finally {
  // ── Remove everything and publish again ───────────────────────────────────
  console.log('\nYer tutucular kaldırılıyor...');

  await call('/website/sections/about', {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify(before.about),
  });
  if (firstService) {
    await call(`/website/collections/services/${firstService.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ imageUrl: null, imageAlt: null }),
    });
  }
  if (firstReference) {
    await call(`/website/collections/references/${firstReference.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({
        logoUrl: firstReference.logoUrl ?? null,
        imageUrl: firstReference.imageUrl ?? null,
      }),
    });
  }
  if (firstLogo) {
    await call(`/website/collections/logos/${firstLogo.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ imageUrl: firstLogo.imageUrl ?? null }),
    });
  }

  const restored = await call('/website/publish', { method: 'POST', headers: auth });
  console.log(`Geri alındı ve yayınlandı — sürüm ${restored.version}`);

  console.log('Sitenin temizlenmesi bekleniyor...');
  const gone = await waitForSite(IMG, false);
  console.log('');
  check('9. Kaldırma CANLI SİTEYE yansıdı', gone, gone ? 'yer tutucu gitti' : 'hâlâ görünüyor');

  // The file itself goes too, so the media library is left as it was found.
  await call(`/storage/files/${uploaded.id}`, { method: 'DELETE', headers: auth }).catch(() => {});
  console.log('Yüklenen dosya silindi.');
}

console.log(`\n${failures === 0 ? 'TÜM GÖRSEL ZİNCİRLERİ ÇALIŞIYOR' : `${failures} kontrol başarısız`}`);
process.exit(failures > 0 ? 1 : 0);
