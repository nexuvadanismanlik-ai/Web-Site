/**
 * Real timings for the admin panel, against production.
 *
 * Written because "the panel is slow" is not something you can fix — you have
 * to know *which* part is slow and whether it is the platform going to sleep or
 * the application itself. Those two have completely different remedies and look
 * identical from a chair.
 *
 * It logs in through the panel's own NextAuth credentials flow and then fetches
 * every screen the way a navigation does, so the numbers are the ones a person
 * actually waits through.
 *
 *   node scripts/measure-admin.mjs
 *   node scripts/measure-admin.mjs --rounds 3
 */

const ADMIN = (process.env.MEASURE_ADMIN_URL ?? 'https://nexuva-admin.onrender.com').replace(
  /\/+$/,
  '',
);
const API = (
  process.env.MEASURE_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');

const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';

const roundsArg = process.argv.indexOf('--rounds');
const ROUNDS = roundsArg > -1 ? Number(process.argv[roundsArg + 1]) || 2 : 2;

/** Every screen, in the order somebody actually clicks through them. */
const SCREENS = [
  ['Dashboard', '/'],
  ['Marka', '/brand'],
  ['Hero', '/hero'],
  ['Hizmetler', '/services'],
  ['Referanslar', '/references'],
  ['Görüşler', '/testimonials'],
  ['Süreç', '/process'],
  ['Menü & Footer', '/navigation'],
  ['Hakkımızda', '/about'],
  ['İletişim', '/contact'],
  ['Metinler', '/texts'],
  ['Medya', '/media'],
  ['CRM', '/crm'],
  ['Mesajlar', '/messages'],
  ['İstatistikler', '/stats'],
  ['SEO', '/seo'],
  ['Entegrasyonlar', '/integrations'],
  ['Mail', '/mail'],
  ['Ziyaretçiler', '/analytics'],
  ['Yayın', '/publish'],
  ['Sistem', '/system'],
  ['Ayarlar', '/settings'],
];

const jar = new Map();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function absorb(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

/** One request, timed, following redirects manually so each hop is visible. */
async function timed(url, options = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      ...options,
      headers: {
        'user-agent': 'nexuva-measure/1.0',
        ...(jar.size ? { cookie: cookieHeader() } : {}),
        ...(options.headers ?? {}),
      },
    });
    absorb(res);
    const body = await res.text();
    return { ms: Date.now() - started, status: res.status, body, headers: res.headers };
  } catch (err) {
    return { ms: Date.now() - started, status: 0, body: '', error: err.message };
  }
}

function ms(value) {
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}s`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${value}ms`;
}

/** How the number reads against the target the panel is held to. */
function verdict(value) {
  if (value < 1000) return '🟢';
  if (value < 2000) return '🟡';
  if (value < 5000) return '🟠';
  return '🔴';
}

async function main() {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('NEXUVA — ADMIN PERFORMANS ÖLÇÜMÜ');
  console.log(`admin: ${ADMIN}`);
  console.log(`api:   ${API}`);
  console.log(`${'═'.repeat(70)}\n`);

  // ── 1. Cold vs warm ─────────────────────────────────────────────────
  // The single most important distinction: a platform waking up is not the
  // same problem as an application that is slow while awake, and they are
  // indistinguishable from the outside unless you measure them apart.
  console.log('1. API — COLD vs WARM\n');
  const apiProbes = [];
  for (let i = 0; i < 5; i++) {
    const r = await timed(`${API}/health`);
    apiProbes.push(r.ms);
    console.log(
      `   ${i === 0 ? 'ilk (cold olabilir)' : `${i + 1}. istek        `}  ${verdict(r.ms)} ${ms(r.ms).padStart(7)}  HTTP ${r.status}`,
    );
  }
  const apiCold = apiProbes[0];
  const apiWarm = Math.round(apiProbes.slice(1).reduce((a, b) => a + b, 0) / (apiProbes.length - 1));

  console.log('\n2. ADMIN — COLD vs WARM (giriş sayfası)\n');
  const adminProbes = [];
  for (let i = 0; i < 5; i++) {
    const r = await timed(`${ADMIN}/login`);
    adminProbes.push(r.ms);
    console.log(
      `   ${i === 0 ? 'ilk (cold olabilir)' : `${i + 1}. istek        `}  ${verdict(r.ms)} ${ms(r.ms).padStart(7)}  HTTP ${r.status}`,
    );
  }
  const adminCold = adminProbes[0];
  const adminWarm = Math.round(
    adminProbes.slice(1).reduce((a, b) => a + b, 0) / (adminProbes.length - 1),
  );

  // ── 3. Log in ───────────────────────────────────────────────────────
  console.log('\n3. GİRİŞ\n');
  const csrf = await timed(`${ADMIN}/api/auth/csrf`);
  let csrfToken = '';
  try {
    csrfToken = JSON.parse(csrf.body).csrfToken;
  } catch {
    /* reported below */
  }
  console.log(`   csrf                 ${verdict(csrf.ms)} ${ms(csrf.ms).padStart(7)}  HTTP ${csrf.status}`);
  if (!csrfToken) {
    console.log('\n   ❌ csrf alınamadı — oturum açılamıyor, ölçüm burada duruyor.');
    console.log(`   yanıt: ${csrf.body.slice(0, 200)}`);
    return;
  }

  const login = await timed(`${ADMIN}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: `${ADMIN}/`,
      json: 'true',
    }).toString(),
  });
  console.log(
    `   kimlik doğrulama     ${verdict(login.ms)} ${ms(login.ms).padStart(7)}  HTTP ${login.status}`,
  );

  const session = await timed(`${ADMIN}/api/auth/session`);
  let signedIn = false;
  try {
    signedIn = Boolean(JSON.parse(session.body)?.user);
  } catch {
    /* reported below */
  }
  console.log(
    `   oturum kontrolü      ${verdict(session.ms)} ${ms(session.ms).padStart(7)}  ${signedIn ? '✅ giriş yapıldı' : '❌ oturum yok'}`,
  );

  if (!signedIn) {
    console.log(`\n   ❌ Giriş başarısız. Yanıt: ${session.body.slice(0, 200)}`);
    return;
  }

  // ── 4. Every screen, several rounds ─────────────────────────────────
  // Round 1 includes each route's first compile/render on the server. Later
  // rounds are what a person navigating around actually experiences, which is
  // the number the panel should be judged on.
  console.log(`\n4. EKRANLAR — ${ROUNDS} tur\n`);
  const results = new Map();

  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`   ── Tur ${round} ${'─'.repeat(52)}`);
    for (const [label, path] of SCREENS) {
      const r = await timed(`${ADMIN}${path}`);
      const list = results.get(label) ?? [];
      list.push({ ms: r.ms, status: r.status, bytes: r.body.length });
      results.set(label, list);
      console.log(
        `   ${label.padEnd(16)} ${verdict(r.ms)} ${ms(r.ms).padStart(8)}  HTTP ${r.status}  ${(r.body.length / 1024).toFixed(0)}KB`,
      );
    }
    console.log('');
  }

  // ── 5. Summary ──────────────────────────────────────────────────────
  console.log(`${'═'.repeat(70)}`);
  console.log('ÖZET');
  console.log(`${'═'.repeat(70)}\n`);

  console.log('COLD START');
  console.log(`  API   ilk istek : ${ms(apiCold)}`);
  console.log(`  ADMIN ilk istek : ${ms(adminCold)}`);
  console.log('\nWARM');
  console.log(`  API   ortalama  : ${ms(apiWarm)}`);
  console.log(`  ADMIN ortalama  : ${ms(adminWarm)}`);

  // The last round is the honest navigation number: everything that could be
  // warmed is warm by then.
  const lastRound = [...results.entries()].map(([label, runs]) => ({
    label,
    ms: runs[runs.length - 1].ms,
    status: runs[runs.length - 1].status,
    bytes: runs[runs.length - 1].bytes,
    first: runs[0].ms,
  }));

  const nav = lastRound.map((r) => r.ms);
  const avg = Math.round(nav.reduce((a, b) => a + b, 0) / nav.length);
  const slowest = lastRound.slice().sort((a, b) => b.ms - a.ms)[0];
  const fastest = lastRound.slice().sort((a, b) => a.ms - b.ms)[0];

  console.log('\nADMIN NAVIGATION (son tur — hepsi warm)');
  console.log(`  ortalama        : ${verdict(avg)} ${ms(avg)}`);
  console.log(`  en yavaş        : ${verdict(slowest.ms)} ${ms(slowest.ms)}  (${slowest.label})`);
  console.log(`  en hızlı        : ${verdict(fastest.ms)} ${ms(fastest.ms)}  (${fastest.label})`);

  console.log('\nEKRAN BAZINDA (warm)\n');
  console.log(`  ${'Ekran'.padEnd(16)} ${'warm'.padStart(9)} ${'ilk tur'.padStart(9)}  ${'HTML'.padStart(6)}`);
  console.log(`  ${'-'.repeat(16)} ${'-'.repeat(9)} ${'-'.repeat(9)}  ${'-'.repeat(6)}`);
  for (const row of lastRound.slice().sort((a, b) => b.ms - a.ms)) {
    console.log(
      `  ${row.label.padEnd(16)} ${verdict(row.ms)}${ms(row.ms).padStart(8)} ${ms(row.first).padStart(9)}  ${(row.bytes / 1024).toFixed(0).padStart(4)}KB`,
    );
  }

  const overTarget = lastRound.filter((r) => r.ms > 2000);
  console.log(`\nHEDEF: warm geçiş < 1s (kabul edilebilir: < 2s)`);
  console.log(
    overTarget.length === 0
      ? '✅ Bütün ekranlar hedefte.'
      : `🔴 ${overTarget.length}/${lastRound.length} ekran 2 saniyeyi aşıyor.`,
  );

  console.log(`\n${'═'.repeat(70)}\n`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
