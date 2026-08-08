/**
 * Brings the brand colours in line with the logo.
 *
 * The site is currently running two palettes at once. The design system taken
 * from the actual logo — a gold serif monogram on charcoal — supplies the gold
 * used 113 times on the home page: the rules, the eyebrows, the nav marker, the
 * monogram, the process rail, the scroll indicator. Underneath it,
 * `brand.primaryColor` is still #6366f1 and `accentColor` #a855f7, seeded from
 * the original template, and those drive the primary button, the icon tint, the
 * hero chart line and every glow.
 *
 * So the page's main call to action is an indigo-to-violet gradient sitting in
 * the middle of a gold-and-charcoal page. That gradient is also, specifically,
 * the palette the brief called out as making the site look like every other
 * generated SaaS landing page.
 *
 * Charcoal instead. White text on a deep graphite pill, gold everywhere the
 * accent belongs — which is the logo's own arrangement rather than a second
 * scheme competing with it. The chart line goes near-black, which is what a
 * broadsheet does with a trend line and why those read as serious.
 *
 * Both values are ordinary panel fields: Ayarlar → Marka → Ana Renk / Vurgu
 * Rengi. If this reads as too austere it is one click back, and nothing in the
 * code depends on the specific values.
 *
 *   node scripts/repair-brand-colours.mjs           # dry run
 *   node scripts/repair-brand-colours.mjs --write
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';
const WRITE = process.argv.includes('--write');

/** The logo's ground, and one step lighter so the gradient has a direction. */
const PRIMARY = '#1c2130';
const ACCENT = '#39415a';

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
  console.log(`\nMarka renkleri — ${API}\n`);

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

  const section = await api('/website/sections/brand?tenant=nexuva');
  const data = section.body?.data ?? {};

  console.log(`  Ana renk  : ${data.primaryColor}  →  ${PRIMARY}`);
  console.log(`  Vurgu     : ${data.accentColor}  →  ${ACCENT}`);

  if (data.primaryColor === PRIMARY && data.accentColor === ACCENT) {
    console.log('\n✅ Zaten güncel.\n');
    return;
  }
  if (!WRITE) {
    console.log('\nYazmak için --write ekle.\n');
    return;
  }

  // Merged. Brand carries the address, the phone, the social links and the
  // taglines; rebuilding the object from the two fields being changed is how
  // an earlier repair on this project silently deleted a sibling.
  const saved = await api('/website/sections/brand?tenant=nexuva', {
    method: 'PUT',
    body: JSON.stringify({ ...data, primaryColor: PRIMARY, accentColor: ACCENT }),
  });
  console.log(`\n${saved.status === 200 ? '✅' : '❌'} yazıldı (HTTP ${saved.status})`);

  const back = await api('/website/sections/brand?tenant=nexuva');
  const after = back.body?.data ?? {};

  const checks = [
    ['ana renk uygulandı', after.primaryColor === PRIMARY],
    ['vurgu rengi uygulandı', after.accentColor === ACCENT],
    ['site adı yerinde', Boolean(after.siteName)],
    ['logo metni yerinde', Boolean(after.logoText)],
    ['e-posta yerinde', Boolean(after.email)],
    ['telefon yerinde', Boolean(after.phone)],
    ['adres yerinde', Boolean(after.address?.tr)],
    ['slogan yerinde', Boolean(after.tagline?.tr)],
    ['sosyal bağlantılar yerinde', (after.social ?? []).length > 0],
    ['tema yerinde', Boolean(after.theme)],
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
