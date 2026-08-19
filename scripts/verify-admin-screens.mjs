/**
 * Signs into the live panel and opens the screens, as a person would.
 *
 * The obvious check — request the route and see that it is not a 404 — does not
 * work here and quietly looks like it does. The admin middleware redirects
 * every unauthenticated request to the login screen before routing happens, so
 * a route that does not exist answers 307 exactly like one that does. An
 * earlier version of this script reported both new screens live sixty seconds
 * after the push, before the deploy could possibly have finished.
 *
 * So it authenticates through NextAuth's own credentials flow — CSRF token,
 * callback, session cookie — and then looks for words that only the new screens
 * render. That also exercises the login path itself, which was a P0 on this
 * project twice.
 *
 *   node scripts/verify-admin-screens.mjs
 */

const ADMIN = (process.env.VERIFY_ADMIN_URL ?? 'https://nexuva-admin.onrender.com').replace(
  /\/+$/,
  '',
);
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';

let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${detail}`}`);
  if (ok) passed++;
  else failed++;
  return ok;
}

/** Cookie jar. Small enough that a library would be more code than this. */
const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function absorb(response) {
  // getSetCookie is the only way to read multiple Set-Cookie headers; the
  // plain .get() collapses them into one string and loses all but the first.
  for (const line of response.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';');
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}

async function visit(path, options = {}) {
  const res = await fetch(`${ADMIN}${path}`, {
    redirect: 'manual',
    ...options,
    headers: { cookie: cookieHeader(), ...(options.headers ?? {}) },
  });
  absorb(res);
  return res;
}

async function main() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`ADMIN EKRANLARI — ${ADMIN}`);
  console.log(`${'═'.repeat(64)}\n`);

  // ── 1. Sign in ──────────────────────────────────────────────────────
  console.log('1. Panele giriş');
  const csrfRes = await visit('/api/auth/csrf');
  const csrfToken = (await csrfRes.json().catch(() => ({})))?.csrfToken;
  if (!check(Boolean(csrfToken), 'CSRF belirteci alındı', `HTTP ${csrfRes.status}`)) {
    process.exit(1);
  }

  const started = Date.now();
  const callback = await visit('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      json: 'true',
      callbackUrl: `${ADMIN}/`,
    }).toString(),
  });
  const seconds = Math.round((Date.now() - started) / 100) / 10;

  const sessionCookie = [...jar.keys()].find((name) => name.includes('session-token'));
  if (!check(Boolean(sessionCookie), 'Oturum açıldı', `HTTP ${callback.status}`)) {
    console.log(`\n  Yanıt: ${(await callback.text()).slice(0, 300)}\n`);
    process.exit(1);
  }
  console.log(`     giriş süresi: ${seconds} sn`);
  // The login was unusable at minutes-long waits once. Not a hard failure —
  // this service sleeps when idle and a cold start is not a regression — but
  // the number belongs in the output where a change in it is visible.
  check(seconds < 90, 'Giriş makul sürede tamamlandı', `${seconds} sn`);

  // ── 2. The screens ──────────────────────────────────────────────────
  console.log('\n2. Ekranlar');
  const SCREENS = [
    {
      path: '/links',
      label: 'Bağlantılar',
      // Words the screen renders and no other screen does.
      markers: ['LogiOps — Giriş', 'Sistemdeki tüm bağlantılar', 'Üyelik Başvurusu'],
    },
    {
      path: '/logiops',
      label: 'LogiOps Sayfası',
      markers: ['Başlık — vurgulu bölüm', 'Kapanış başlığı'],
    },
  ];

  for (const screen of SCREENS) {
    const res = await visit(screen.path, { redirect: 'follow' });
    const html = await res.text();
    if (!check(res.status === 200, `${screen.label} açılıyor`, `HTTP ${res.status}`)) continue;
    for (const marker of screen.markers) {
      check(html.includes(marker), `${screen.label}: “${marker}” görünüyor`);
    }
    check((html.match(/�/g) ?? []).length === 0, `${screen.label}: bozuk karakter yok`);
  }

  // ── 3. The audit found the real problems ────────────────────────────
  // The link table's whole purpose is spotting addresses that resolve and are
  // still wrong. If it cannot see the ones known to be there, it sees nothing.
  console.log('\n3. Bağlantı denetimi');
  const linksPage = await visit('/links', { redirect: 'follow' });
  const linksHtml = await linksPage.text();
  check(linksHtml.includes('bağlantı tarandı'), 'Denetim tablosu çalıştı');
  check(
    linksHtml.includes('Platformun ana sayfası'),
    'Yer tutucu sosyal bağlantıları yakaladı',
    'linkedin.com gibi adresler işaretlenmedi',
  );

  // ── 4. Sidebar ──────────────────────────────────────────────────────
  console.log('\n4. Menü');
  check(linksHtml.includes('href="/links"'), 'Bağlantılar menüde');
  check(linksHtml.includes('href="/logiops"'), 'LogiOps Sayfası menüde');

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`${passed} geçti, ${failed} kaldı`);
  console.log(failed === 0 ? '\n✅ Admin ekranları canlı doğrulandı.\n' : '\n❌ Eksik var.\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
