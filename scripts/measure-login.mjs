/**
 * Where the login goes when it never comes back.
 *
 * The report is "the spinner runs forever". That has several possible causes
 * with different fixes — the request never leaves, the API is asleep, the
 * session refresh hangs, the form never learns the outcome — and they are
 * indistinguishable from a chair. This times each hop separately.
 *
 *   node scripts/measure-login.mjs
 *   node scripts/measure-login.mjs --cold    (after the service has idled)
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

const jar = new Map();
const cookies = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

function ms(v) {
  return v >= 10_000 ? `${(v / 1000).toFixed(1)}s` : v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v}ms`;
}

function flag(v) {
  if (v < 1000) return '🟢';
  if (v < 3000) return '🟡';
  if (v < 10_000) return '🟠';
  return '🔴';
}

async function timed(label, url, options = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      ...options,
      headers: {
        'user-agent': 'nexuva-login-probe/1.0',
        ...(jar.size ? { cookie: cookies() } : {}),
        ...(options.headers ?? {}),
      },
    });
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    const body = await res.text();
    const took = Date.now() - started;
    console.log(`  ${flag(took)} ${ms(took).padStart(8)}  ${String(res.status).padStart(3)}  ${label}`);
    return { ms: took, status: res.status, body };
  } catch (err) {
    const took = Date.now() - started;
    console.log(`  🔴 ${ms(took).padStart(8)}  ---  ${label} — ${err.message}`);
    return { ms: took, status: 0, body: '', error: err.message };
  }
}

async function main() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log('ADMIN GİRİŞ ZİNCİRİ');
  console.log(`${'═'.repeat(64)}\n`);

  // ── 1. The API's own login, direct ──────────────────────────────────
  // If this is fast and the panel is slow, the fault is between them.
  console.log('1. API doğrudan');
  const direct = await timed('POST /auth/login', `${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  const wrong = await timed('POST /auth/login (yanlış şifre)', `${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: 'kesinlikle-yanlis-sifre' }),
  });

  let token = null;
  let refreshToken = null;
  try {
    const parsed = JSON.parse(direct.body);
    token = parsed?.data?.accessToken ?? parsed?.accessToken;
    refreshToken = parsed?.data?.refreshToken ?? parsed?.refreshToken;
  } catch {
    /* reported by status above */
  }

  // ── 2. The refresh endpoint ─────────────────────────────────────────
  // Runs on every getServerSession once the access token nears expiry, so if
  // this is slow, every page of the panel is slow — including the first.
  console.log('\n2. Oturum yenileme (her sayfa yüklemesinde çalışabilir)');
  if (refreshToken) {
    await timed('POST /auth/refresh', `${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    await timed('POST /auth/refresh (2. kez)', `${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } else {
    console.log('  ⚠  refresh token alınamadı, atlandı');
  }

  // ── 3. The panel's own login flow ───────────────────────────────────
  console.log('\n3. Panel giriş akışı (NextAuth)');
  await timed('GET /login', `${ADMIN}/login`);
  const csrf = await timed('GET /api/auth/csrf', `${ADMIN}/api/auth/csrf`);

  let csrfToken = '';
  try {
    csrfToken = JSON.parse(csrf.body).csrfToken;
  } catch {
    console.log('  ❌ csrf alınamadı — akış burada duruyor');
    return;
  }

  const signIn = await timed(
    'POST /api/auth/callback/credentials',
    `${ADMIN}/api/auth/callback/credentials`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        csrfToken,
        email: EMAIL,
        password: PASSWORD,
        callbackUrl: `${ADMIN}/`,
        json: 'true',
      }).toString(),
    },
  );

  const session = await timed('GET /api/auth/session', `${ADMIN}/api/auth/session`);
  let signedIn = false;
  try {
    signedIn = Boolean(JSON.parse(session.body)?.user);
  } catch {
    /* below */
  }
  console.log(`     → ${signedIn ? '✅ oturum açıldı' : '❌ oturum yok'}`);

  // ── 4. Wrong password, through the panel ────────────────────────────
  // The failure has to be distinguishable from an unreachable API. If both
  // read as "wrong password", somebody will spend an evening retyping it.
  console.log('\n4. Yanlış şifre (panel üzerinden)');
  const jarBackup = new Map(jar);
  jar.clear();
  const csrf2 = await timed('GET /api/auth/csrf', `${ADMIN}/api/auth/csrf`);
  let csrfToken2 = '';
  try {
    csrfToken2 = JSON.parse(csrf2.body).csrfToken;
  } catch {
    /* below */
  }
  const badLogin = await timed(
    'POST callback (yanlış şifre)',
    `${ADMIN}/api/auth/callback/credentials`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        csrfToken: csrfToken2,
        email: EMAIL,
        password: 'kesinlikle-yanlis-sifre',
        callbackUrl: `${ADMIN}/`,
        json: 'true',
      }).toString(),
    },
  );
  console.log(`     → yanıt: ${badLogin.body.slice(0, 160)}`);
  jar.clear();
  for (const [k, v] of jarBackup) jar.set(k, v);

  // ── 5. First load of the panel itself ───────────────────────────────
  console.log('\n5. Panel ilk açılış (oturum açıkken)');
  await timed('GET / (dashboard)', `${ADMIN}/`);
  await timed('GET / (2. kez)', `${ADMIN}/`);

  // ── Summary ─────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(64)}`);
  console.log('ÖZET\n');
  console.log(`  API doğrudan giriş     : ${ms(direct.ms)}  HTTP ${direct.status}`);
  console.log(`  API yanlış şifre       : ${ms(wrong.ms)}  HTTP ${wrong.status}`);
  console.log(`  Panel giriş çağrısı    : ${ms(signIn.ms)}  HTTP ${signIn.status}`);
  console.log(`  Oturum doğrulandı      : ${signedIn ? 'evet' : 'HAYIR'}`);
  console.log('');
  console.log(
    signIn.ms > 10_000
      ? '🔴 Panel giriş çağrısı 10 saniyeden uzun — kullanıcı bunu "sonsuz" olarak yaşıyor.'
      : '🟢 Panel giriş çağrısı makul sürede döndü.',
  );
  console.log(`\n${'═'.repeat(64)}\n`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
