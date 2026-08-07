/**
 * Why the admin panel answers 500 under sustained navigation.
 *
 * A first guess — that the API's per-IP rate limit was being exhausted by the
 * server-rendered panel, since every call it makes arrives from one address —
 * did not survive measurement: 115 requests in a row drew no 429 at all. So
 * this stops guessing and captures what the failure actually is: the raw body,
 * the response headers, and whether the panel recovers on its own.
 *
 *   node scripts/diagnose-admin-500.mjs
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

async function req(url, options = {}) {
  const started = Date.now();
  const res = await fetch(url, {
    redirect: 'manual',
    ...options,
    headers: {
      'user-agent': 'nexuva-diagnose/1.0',
      ...(jar.size ? { cookie: cookies() } : {}),
      ...(options.headers ?? {}),
    },
  });
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  return {
    ms: Date.now() - started,
    status: res.status,
    body: await res.text(),
    headers: Object.fromEntries(res.headers.entries()),
  };
}

/** The heaviest screens — the fastest way to reach whatever the limit is. */
const HEAVY = ['/', '/crm', '/analytics', '/mail', '/publish', '/messages', '/stats', '/seo'];

async function main() {
  console.log('\nAdmin 500 teşhisi\n');

  const csrfToken = JSON.parse((await req(`${ADMIN}/api/auth/csrf`)).body).csrfToken;
  await req(`${ADMIN}/api/auth/callback/credentials`, {
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
  if (!JSON.parse((await req(`${ADMIN}/api/auth/session`)).body)?.user) {
    console.log('❌ giriş yapılamadı');
    return;
  }
  console.log('✅ giriş yapıldı\n');

  let failure = null;
  let loads = 0;

  outer: for (let round = 1; round <= 10; round++) {
    for (const path of HEAVY) {
      const r = await req(`${ADMIN}${path}`);
      loads++;
      process.stdout.write(r.status === 200 ? '.' : 'X');
      if (loads % 40 === 0) process.stdout.write(` ${loads}\n`);
      if (r.status !== 200) {
        failure = { path, ...r, at: loads };
        break outer;
      }
    }
  }
  console.log('');

  if (!failure) {
    console.log(`\n✅ ${loads} yükleme boyunca hata çıkmadı.`);
    return;
  }

  console.log(`\n🔴 ${failure.at}. yüklemede koptu: ${failure.path} → HTTP ${failure.status}\n`);

  console.log('Yanıt başlıkları:');
  for (const [k, v] of Object.entries(failure.headers)) {
    if (/error|digest|render|x-|content-type/i.test(k)) console.log(`  ${k}: ${v}`);
  }

  console.log('\nGövde (ham, ilk 900 karakter):');
  console.log(failure.body.slice(0, 900).replace(/^/gm, '  '));

  // Was it the API underneath, or the panel itself? Ask the API directly at the
  // same moment — if the API is fine, the fault is in the panel's own process.
  console.log('\nAynı anda API doğrudan:');
  const health = await req(`${API}/health`);
  console.log(`  /health → HTTP ${health.status} (${health.ms}ms)`);
  const content = await req(`${API}/website/content?state=draft`);
  console.log(`  /website/content → HTTP ${content.status} (${content.ms}ms)`);

  // Does it clear on its own? A limiter resets on a timer; a crashed process
  // recovers when it restarts. Both recover, but at very different speeds.
  console.log('\nKendine geliyor mu?');
  for (const wait of [3, 10, 30, 60]) {
    await new Promise((r) => setTimeout(r, wait * 1000));
    const again = await req(`${ADMIN}${failure.path}`);
    console.log(`  +${String(wait).padStart(2)}s → HTTP ${again.status} (${again.ms}ms)`);
    if (again.status === 200) break;
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
