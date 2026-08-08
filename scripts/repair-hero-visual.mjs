/**
 * Unhooks the placeholder mockup from the hero so the animated visual renders.
 *
 * The hero shows an uploaded image when there is one and draws an illustration
 * when there is not. What was uploaded is `hero-mockup.svg` — a placeholder
 * generated during seeding, and by now wrong three separate ways:
 *
 *   · it is drawn in the old indigo/violet palette, which this site no longer
 *     uses anywhere else;
 *   · its background is baked to #f6f7fb, so in dark mode it is a white slab
 *     in the middle of the page;
 *   · it is static, and the chart in it is exactly the element the brief asks
 *     to see grow.
 *
 * Clearing the field is enough: the animated composition takes the slot back on
 * its own, in the current palette, theme-aware, with the line drawing itself in
 * and the bars filling. The file is NOT deleted — it stays in the Media Library
 * and this is reversible from the panel in one click. Uploading a real product
 * screenshot later still wins, which is the behaviour that should not change.
 *
 *   node scripts/repair-hero-visual.mjs           # dry run
 *   node scripts/repair-hero-visual.mjs --write
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';
const WRITE = process.argv.includes('--write');

let auth = {};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
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
  return { status: res.status, body: body?.data ?? body };
}

async function main() {
  console.log(`\nHero görseli — ${API}\n`);

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.body?.accessToken ?? login.body?.token;
  if (!token) {
    console.log(`❌ giriş yapılamadı (HTTP ${login.status})`);
    process.exit(1);
  }
  auth = { Authorization: `Bearer ${token}` };

  const section = await api('/website/sections/hero?tenant=nexuva');
  const data = section.body?.data ?? {};

  console.log(`Mevcut hero.image: ${data.image || '(boş)'}`);
  if (!data.image) {
    console.log('\n✅ Zaten boş — animasyonlu görsel çiziliyor.\n');
    return;
  }

  console.log('\nBu görsel kaldırılacak; dosya kütüphanede kalıyor.');
  if (!WRITE) {
    console.log('Yazmak için --write ekle.\n');
    return;
  }

  // Merged, never rebuilt. An earlier repair script on this project spread a
  // section and replaced one nested object wholesale, dropped the sibling it
  // did not name, and took the home page down until somebody noticed.
  const saved = await api('/website/sections/hero?tenant=nexuva', {
    method: 'PUT',
    body: JSON.stringify({ ...data, image: '', imageAlt: '' }),
  });
  console.log(`${saved.status === 200 ? '✅' : '❌'} yazıldı (HTTP ${saved.status})`);

  // Read it back. "Saved" is what the last script that broke this said too.
  const back = await api('/website/sections/hero?tenant=nexuva');
  const after = back.body?.data ?? {};

  const checks = [
    ['hero.image boşaldı', !after.image],
    ['başlık yerinde', Boolean(after.titleLead?.tr)],
    ['vurgu yerinde', Boolean(after.titleHighlight?.tr)],
    ['alt başlık yerinde', Boolean(after.subtitle?.tr)],
    ['rozet yerinde', Boolean(after.badge?.tr)],
    ['birincil buton adresi', Boolean(after.primaryCta?.href)],
    ['birincil buton metni', Boolean(after.primaryCta?.label?.tr)],
    ['ikincil buton adresi', Boolean(after.secondaryCta?.href)],
    ['ikincil buton metni', Boolean(after.secondaryCta?.label?.tr)],
  ];

  console.log('');
  let bad = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (!ok) bad++;
  }
  if (bad > 0) {
    console.log('\n❌ Bir alan kayboldu — yayınlanmadı.\n');
    process.exit(1);
  }

  const published = await api('/website/publish?tenant=nexuva', { method: 'POST' });
  console.log(`\nYayın: HTTP ${published.status} — ${published.body?.detail ?? ''}\n`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
