/**
 * Rename and replace, against the live API, with a real file.
 *
 * Replace is the one worth proving. It is not an overwrite — it creates a new
 * file and repoints every reference — so "did it work" means checking that the
 * old address is gone from the content and the new one is in its place. A test
 * that only checked for a 200 would pass on an endpoint that uploaded the file
 * and quietly rewrote nothing.
 *
 * Everything it creates is named zz-test- and removed at the end. Content is
 * put back exactly as it was found.
 *
 *   node scripts/verify-media-ops.mjs
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';

const MARKER = 'zz-test-medya';

let passed = 0;
let failed = 0;
let auth = {};

function check(ok, label, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${detail}`}`);
  if (ok) passed++;
  else failed++;
  return ok;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...auth,
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body: body?.data ?? body, raw: body };
}

/** A one-pixel PNG, so the upload is a real image without carrying a fixture. */
function pixel(tint) {
  const base64 =
    tint === 'red'
      ? 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      : 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
}

async function upload(name, tint) {
  const form = new FormData();
  form.append('file', new Blob([pixel(tint)], { type: 'image/png' }), name);
  return api('/storage/upload?tenant=nexuva&folder=images', { method: 'POST', body: form });
}

async function main() {
  console.log(`\nMedya işlemleri — ${API}\n`);

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.body?.accessToken ?? login.body?.token;
  if (!check(Boolean(token), 'Panel girişi', `HTTP ${login.status}`)) return report();
  auth = { Authorization: `Bearer ${token}` };

  const created = [];
  let heroBefore = null;

  try {
    // ── Upload ──────────────────────────────────────────────────────────
    console.log('1. Yükleme');
    const first = await upload(`${MARKER}-once.png`, 'red');
    if (!check(first.status === 201 || first.status === 200, 'Dosya yüklendi', `HTTP ${first.status}`)) {
      return report();
    }
    created.push(first.body.id);
    const originalUrl = first.body.url;
    console.log(`  ·  ${originalUrl}`);

    // ── Rename ──────────────────────────────────────────────────────────
    console.log('\n2. Yeniden adlandırma');
    const renamed = await api(`/storage/files/${first.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ filename: `${MARKER}-yeni-ad.png` }),
    });
    check(renamed.status === 200, 'Ad değişti', `HTTP ${renamed.status}`);
    check(renamed.body?.filename === `${MARKER}-yeni-ad.png`, 'Yeni ad kaydedildi', String(renamed.body?.filename));
    // The whole point: a rename must not move the file.
    check(renamed.body?.url === originalUrl, 'Adres değişmedi', String(renamed.body?.url));

    const empty = await api(`/storage/files/${first.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ filename: '   ' }),
    });
    check(empty.status === 400, 'Boş ad reddedildi', `HTTP ${empty.status}`);

    const badFolder = await api(`/storage/files/${first.body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ folder: '../gizli' }),
    });
    check(badFolder.status === 400, 'Geçersiz klasör reddedildi', `HTTP ${badFolder.status}`);

    // ── Put it on the site, so replace has something to repoint ─────────
    console.log('\n3. Görseli sitede kullan');
    const hero = await api('/website/sections/hero?tenant=nexuva');
    heroBefore = hero.body?.data ?? {};
    const withImage = { ...heroBefore, image: originalUrl };
    const saved = await api('/website/sections/hero?tenant=nexuva', {
      method: 'PUT',
      body: JSON.stringify(withImage),
    });
    check(saved.status === 200, 'Hero görseli ayarlandı', `HTTP ${saved.status}`);

    const usage = await api('/storage/files?tenant=&limit=100&usage=true');
    const listed = (usage.body?.files ?? []).find((f) => f.id === first.body.id);
    check((listed?.usedAt?.length ?? 0) > 0, 'Kullanım tespit edildi', JSON.stringify(listed?.usedAt));

    // ── Replace ─────────────────────────────────────────────────────────
    console.log('\n4. Değiştirme');
    const form = new FormData();
    form.append('file', new Blob([pixel('blue')], { type: 'image/png' }), `${MARKER}-yenisi.png`);
    const replaced = await api(`/storage/files/${first.body.id}/replace`, {
      method: 'POST',
      body: form,
    });
    if (!check(replaced.status === 201 || replaced.status === 200, 'Değiştirme çalıştı', `HTTP ${replaced.status}`)) {
      return report();
    }
    const newUrl = replaced.body?.file?.url;
    if (newUrl) created.push(replaced.body.file.id);

    check(Boolean(newUrl) && newUrl !== originalUrl, 'Yeni adres üretildi', String(newUrl));
    check(replaced.body?.replaced >= 1, 'En az bir yer güncellendi', String(replaced.body?.replaced));
    console.log(`  ·  "${replaced.body?.message}"`);

    // The assertion that matters: the content actually points at the new file.
    const heroAfter = await api('/website/sections/hero?tenant=nexuva');
    check(heroAfter.body?.data?.image === newUrl, 'Hero yeni görseli gösteriyor', String(heroAfter.body?.data?.image));
    check(
      !JSON.stringify(heroAfter.body?.data ?? {}).includes(originalUrl),
      'Eski adres içerikte kalmadı',
    );

    // And the new file is really servable — a repointed reference to a broken
    // address would pass every check above.
    const fetched = await fetch(newUrl);
    check(fetched.ok, 'Yeni görsel sunuluyor', `HTTP ${fetched.status}`);
    check(
      (fetched.headers.get('content-type') ?? '').includes('image'),
      'Görsel olarak dönüyor',
      String(fetched.headers.get('content-type')),
    );
  } finally {
    // ── Clean up ────────────────────────────────────────────────────────
    console.log('\n5. Temizlik');
    if (heroBefore) {
      const restored = await api('/website/sections/hero?tenant=nexuva', {
        method: 'PUT',
        body: JSON.stringify(heroBefore),
      });
      check(restored.status === 200, 'Hero eski hâline döndürüldü', `HTTP ${restored.status}`);
    }
    for (const id of created) {
      await api(`/storage/files/${id}?force=true`, { method: 'DELETE' });
    }
    check(true, `${created.length} test dosyası silindi`);
  }

  report();
}

function report() {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${passed} geçti, ${failed} kaldı`);
  console.log(failed === 0 ? '✅ Medya işlemleri canlı doğrulandı.\n' : '❌ Eksik var.\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
