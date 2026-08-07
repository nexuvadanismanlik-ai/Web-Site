/**
 * Puts back the two hero link addresses that the encoding repair dropped.
 *
 * The repair spread the section and then replaced `primaryCta` with an object
 * containing only `label`. Spreading the parent does not merge its children —
 * so `href` went with it, `<Link href={undefined}>` threw during prerender,
 * and the home page stopped building.
 *
 * Worth stating plainly because the lesson generalises: a script that patches
 * one field inside a nested object has to merge at every level it touches, and
 * this one merged at the top and clobbered underneath. It typechecked, it
 * reported success, it read the values back and found no damaged characters —
 * and it had broken the page, because it was only ever looking for U+FFFD.
 *
 *   node scripts/repair-hero-links.mjs --write
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

/** Where the two hero buttons go. Both are real routes on this site. */
const LINKS = { primaryCta: '/contact', secondaryCta: '/services' };

async function main() {
  console.log(`\nHero bağlantı onarımı — ${API}\n`);

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

  const hero = await api('/website/sections/hero?tenant=nexuva');
  const data = hero.body?.data ?? {};

  const missing = Object.keys(LINKS).filter((key) => !data[key]?.href);
  console.log(`Adresi eksik buton: ${missing.length ? missing.join(', ') : 'yok'}`);

  if (missing.length === 0) {
    console.log('✅ Onarıma gerek yok.\n');
    return;
  }

  if (!WRITE) {
    console.log('\nYazmak için --write ekle.\n');
    return;
  }

  // Merged at the level being changed, which is the whole point.
  const next = { ...data };
  for (const [key, href] of Object.entries(LINKS)) {
    next[key] = { ...(data[key] ?? {}), href };
  }

  const saved = await api('/website/sections/hero?tenant=nexuva', {
    method: 'PUT',
    body: JSON.stringify(next),
  });
  console.log(`${saved.status === 200 ? '✅' : '❌'} yazıldı (HTTP ${saved.status})`);

  // Read back and check the things that actually have to be true: both links
  // resolve, and the Turkish survived the round trip.
  const back = await api('/website/sections/hero?tenant=nexuva');
  const d = back.body?.data ?? {};
  const ok =
    d.primaryCta?.href === LINKS.primaryCta &&
    d.secondaryCta?.href === LINKS.secondaryCta &&
    d.titleLead?.tr === 'Geleceğin işini bugünden';

  console.log(`  primaryCta.href   : ${d.primaryCta?.href}`);
  console.log(`  secondaryCta.href : ${d.secondaryCta?.href}`);
  console.log(`  titleLead.tr      : ${d.titleLead?.tr}`);
  console.log(ok ? '\n✅ Hero sağlam.\n' : '\n❌ Hâlâ eksik var.\n');

  if (!ok) process.exit(1);

  const published = await api('/website/publish?tenant=nexuva', { method: 'POST' });
  console.log(`Yayın: HTTP ${published.status} — ${published.body?.detail ?? ''}\n`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
