/**
 * Is the panel's server render actually running its calls in parallel?
 *
 * The dashboard issues eight API calls inside a Promise.all. Measured
 * separately, the slowest of those is 350ms — so the screen should cost about
 * 350ms. It costs 1.6s, which is almost exactly the *sum* of the eight. That
 * is the signature of work that is nominally parallel and actually serial, and
 * it is worth proving before optimising anything.
 *
 * Signs in once and reuses the cookie, because the API allows five sign-ins a
 * minute per address and a probe that keeps logging in locks itself out.
 *
 *   node scripts/measure-render.mjs                 (local build)
 *   MEASURE_ADMIN_URL=https://... node scripts/measure-render.mjs
 */

const ADMIN = (process.env.MEASURE_ADMIN_URL ?? 'http://localhost:3100').replace(/\/+$/, '');
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
      'user-agent': 'nexuva-render/1.0',
      ...(jar.size ? { cookie: cookies() } : {}),
      ...(options.headers ?? {}),
    },
  });
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  return { ms: Date.now() - started, status: res.status, body: await res.text() };
}

/** Screens chosen for how many API calls each makes, so the shape is visible. */
const PROBES = [
  ['Ayarlar', '/settings', 1],
  ['Medya', '/media', 1],
  ['Sistem', '/system', 0],
  ['Marka', '/brand', 2],
  ['Mail', '/mail', 3],
  ['CRM', '/crm', 4],
  ['Dashboard', '/', 8],
];

function ms(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v}ms`;
}

function median(values) {
  const s = values.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

async function main() {
  console.log(`\nSUNUCU RENDER ÖLÇÜMÜ — ${ADMIN}\n`);

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
    console.log('❌ giriş yapılamadı (API giriş limiti 5/dk olabilir — bir dakika bekleyip tekrar dene)');
    return;
  }
  console.log('✅ giriş yapıldı — tek oturum, tekrar giriş yok\n');

  // Warm each route once; the first render of a route compiles and connects.
  for (const [, path] of PROBES) await req(`${ADMIN}${path}`);

  console.log(`  ${'Ekran'.padEnd(11)} ${'API çağrısı'.padStart(11)} ${'render'.padStart(9)}`);
  console.log(`  ${'-'.repeat(11)} ${'-'.repeat(11)} ${'-'.repeat(9)}`);

  const rows = [];
  for (const [label, path, calls] of PROBES) {
    const runs = [];
    for (let i = 0; i < 5; i++) runs.push((await req(`${ADMIN}${path}`)).ms);
    const med = median(runs);
    rows.push({ label, calls, med });
    console.log(`  ${label.padEnd(11)} ${String(calls).padStart(11)} ${ms(med).padStart(9)}`);
  }

  // If render time tracks the number of calls, the calls are serial. If it is
  // flat, they are parallel and the cost is one round trip.
  const withCalls = rows.filter((r) => r.calls > 0);
  const perCall = withCalls.map((r) => r.med / r.calls);
  const cheapest = rows.slice().sort((a, b) => a.med - b.med)[0];
  const dearest = rows.slice().sort((a, b) => b.med - a.med)[0];

  console.log(`\n  en ucuz : ${cheapest.label} (${cheapest.calls} çağrı) ${ms(cheapest.med)}`);
  console.log(`  en pahalı: ${dearest.label} (${dearest.calls} çağrı) ${ms(dearest.med)}`);
  console.log(
    `  çağrı başına: ${Math.round(Math.min(...perCall))}–${Math.round(Math.max(...perCall))}ms`,
  );

  const slope =
    (dearest.med - cheapest.med) / Math.max(1, dearest.calls - Math.max(cheapest.calls, 1));
  console.log(`\n  Her ek API çağrısının maliyeti ≈ ${Math.round(slope)}ms`);
  console.log(
    slope > 80
      ? '  → Çağrılar SERİ gidiyor. Promise.all beklenen paralelliği vermiyor.'
      : '  → Çağrılar paralel. Süre çağrı sayısıyla artmıyor.',
  );
  console.log('');
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
