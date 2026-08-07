/**
 * Per-endpoint timings for every API call the admin panel makes.
 *
 * The panel fetches in parallel, so a screen costs roughly what its *slowest*
 * call costs — not the sum. Optimising the wrong one therefore buys nothing,
 * which is why this measures each endpoint separately before anything is
 * changed.
 *
 * Each is called several times and the median reported: a single sample on a
 * shared database is mostly noise.
 *
 *   node scripts/measure-api.mjs
 */

const API = (
  process.env.MEASURE_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';

const SAMPLES = 5;

/** Every endpoint the panel reads, with the screens that wait on it. */
const ENDPOINTS = [
  ['/health', 'sağlık probu'],
  ['/website/content?state=draft', 'Dashboard, Marka, Hero, Hizmetler, CRM, +8'],
  ['/website/contact?limit=100', 'Dashboard(layout), Mesajlar'],
  ['/notifications?unreadOnly=true', 'Dashboard(layout)'],
  ['/website/contact/pipeline/summary', 'Dashboard, CRM'],
  ['/website/contact/pipeline/counts', 'CRM'],
  ['/website/contact/pipeline/assignees', 'CRM'],
  ['/website/publish/status', 'Dashboard, Yayın'],
  ['/website/versions?limit=20', 'Yayın'],
  ['/storage/files?tenant=&limit=100', 'Dashboard, Marka, Medya'],
  ['/mail/logs?limit=50', 'Dashboard, Mail'],
  ['/mail/settings', 'Mail'],
  ['/mail/templates', 'Mail'],
  ['/analytics/summary', 'Dashboard, Ziyaretçiler'],
  ['/health/connections', 'Sistem'],
];

let token = '';

async function timed(path) {
  const started = Date.now();
  try {
    const res = await fetch(`${API}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const body = await res.text();
    return { ms: Date.now() - started, status: res.status, bytes: body.length };
  } catch (err) {
    return { ms: Date.now() - started, status: 0, bytes: 0, error: err.message };
  }
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function flag(value) {
  if (value < 150) return '🟢';
  if (value < 400) return '🟡';
  if (value < 1000) return '🟠';
  return '🔴';
}

function ms(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v}ms`;
}

async function main() {
  console.log(`\nAPI UÇ ÖLÇÜMÜ — ${API}\n`);

  // Warm the service first so the first endpoint measured is not the one that
  // pays for waking it up.
  process.stdout.write('ısıtılıyor... ');
  await timed('/health');
  console.log('tamam\n');

  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await login.json();
  token = body?.data?.accessToken ?? body?.accessToken ?? '';
  if (!token) {
    console.log(`❌ giriş yapılamadı (HTTP ${login.status}) — ölçüm durdu.`);
    return;
  }

  const rows = [];
  for (const [path, users] of ENDPOINTS) {
    const runs = [];
    let status = 0;
    let bytes = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const r = await timed(path);
      runs.push(r.ms);
      status = r.status;
      bytes = r.bytes;
    }
    const med = median(runs);
    rows.push({ path, users, med, min: Math.min(...runs), max: Math.max(...runs), status, bytes });
    console.log(
      `${flag(med)} ${ms(med).padStart(7)}  ${String(status).padStart(3)}  ${(bytes / 1024).toFixed(0).padStart(4)}KB  ${path}`,
    );
  }

  console.log(`\n${'─'.repeat(76)}`);
  console.log('EN YAVAŞTAN EN HIZLIYA (medyan)\n');
  console.log(
    `  ${'medyan'.padStart(8)} ${'en kötü'.padStart(8)}  ${'boyut'.padStart(6)}  uç / bekleyen ekranlar`,
  );
  console.log(`  ${'-'.repeat(8)} ${'-'.repeat(8)}  ${'-'.repeat(6)}  ${'-'.repeat(44)}`);
  for (const r of rows.slice().sort((a, b) => b.med - a.med)) {
    console.log(`  ${flag(r.med)}${ms(r.med).padStart(7)} ${ms(r.max).padStart(8)}  ${(r.bytes / 1024).toFixed(0).padStart(4)}KB  ${r.path}`);
    console.log(`  ${' '.repeat(26)}${r.users}`);
  }

  // What the dashboard actually waits for: its calls run in parallel, so the
  // screen costs the slowest of them, not their sum. Stating both makes it
  // obvious whether to cut calls or to speed one up.
  const dashboard = [
    '/website/content?state=draft',
    '/website/contact?limit=100',
    '/notifications?unreadOnly=true',
    '/website/contact/pipeline/summary',
    '/website/publish/status',
    '/storage/files?tenant=&limit=100',
    '/mail/logs?limit=50',
    '/analytics/summary',
  ];
  const picked = rows.filter((r) => dashboard.includes(r.path));
  const slowest = picked.slice().sort((a, b) => b.med - a.med)[0];
  const sum = picked.reduce((a, r) => a + r.med, 0);

  console.log(`\n${'─'.repeat(76)}`);
  console.log('DASHBOARD\n');
  console.log(`  çağrı sayısı        : ${picked.length} (+ layout'ta 2)`);
  console.log(`  paralel maliyeti    : ${ms(slowest.med)}  ← ${slowest.path}`);
  console.log(`  seri olsaydı        : ${ms(sum)}`);
  console.log(
    `\n  → Ekranı yavaşlatan tek uç: ${slowest.path}\n    Çağrı sayısını azaltmak değil, bunu hızlandırmak gerekiyor.`,
  );
  console.log('');
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
