/**
 * FAZ E–G against the live API: preferences, mail connection check, and the
 * analytics work that depends on both.
 *
 * The timezone assertions matter most. A day boundary that is an hour or a
 * second out does not fail — it quietly moves traffic between rows, and every
 * number stays individually plausible. So this checks the boundary itself
 * rather than checking that a number came back.
 *
 *   node scripts/verify-efg.mjs
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';

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
      // Only when there is a body. Fastify rejects a request that announces
      // JSON and then sends nothing — which made a bodyless POST look like a
      // broken endpoint when the fault was in this script.
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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

async function main() {
  console.log(`\nFAZ E–G — ${API}\n`);

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.body?.accessToken ?? login.body?.token;
  if (!check(Boolean(token), 'Panel girişi', `HTTP ${login.status}`)) return report();
  auth = { Authorization: `Bearer ${token}` };

  // ── E: preferences ───────────────────────────────────────────────────
  console.log('\nE. Ayarlar merkezi');

  const prefs = await api('/website/preferences?tenant=nexuva');
  check(prefs.status === 200, 'Tercihler okunuyor', `HTTP ${prefs.status}`);
  check(typeof prefs.body?.timezone === 'string', 'Zaman dilimi tanımlı', String(prefs.body?.timezone));
  check(
    Array.isArray(prefs.body?.options) && prefs.body.options.length > 1,
    'Seçenek listesi geliyor',
  );

  const original = prefs.body?.timezone ?? 'Europe/Istanbul';

  const bad = await api('/website/preferences?tenant=nexuva', {
    method: 'PUT',
    body: JSON.stringify({ timezone: 'Mars/Olympus' }),
  });
  check(bad.status === 400, 'Tanınmayan zaman dilimi reddediliyor', `HTTP ${bad.status}`);

  const saved = await api('/website/preferences?tenant=nexuva', {
    method: 'PUT',
    body: JSON.stringify({ timezone: 'Europe/Istanbul' }),
  });
  check(saved.status === 200, 'Zaman dilimi kaydediliyor', `HTTP ${saved.status}`);

  const reread = await api('/website/preferences?tenant=nexuva');
  check(reread.body?.timezone === 'Europe/Istanbul', 'Kayıt kalıcı', String(reread.body?.timezone));

  // ── F: mail connection ───────────────────────────────────────────────
  console.log('\nF. Mail bağlantı kontrolü');

  const verify = await api('/mail/verify?tenant=nexuva', { method: 'POST' });
  check(verify.status === 200 || verify.status === 201, 'Kontrol ucu çalışıyor', `HTTP ${verify.status}`);
  check(typeof verify.body?.ok === 'boolean', 'Sonuç bir yargı döndürüyor');
  check(
    typeof verify.body?.detail === 'string' && verify.body.detail.length > 5,
    'Sebep açıklanıyor',
    String(verify.body?.detail),
  );
  console.log(`  ·  "${verify.body?.detail}"`);
  // No key is configured, so a pass here would mean the check is not checking.
  check(verify.body?.ok === false, 'Anahtar yokken doğru şekilde başarısız');

  // ── G: analytics, in the right timezone ──────────────────────────────
  console.log('\nG. Analytics — gün sınırları');

  // Istanbul is UTC+3, so its day starts at 21:00 UTC the day before.
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const today = await api(`/analytics/summary?tenant=nexuva&from=${day}&to=${day}`);
  check(today.status === 200, 'Bugün okunuyor', `HTTP ${today.status}`);
  check(today.body?.range?.timeZone === 'Europe/Istanbul', 'Rapor zaman dilimini bildiriyor', String(today.body?.range?.timeZone));

  const from = new Date(today.body?.range?.from ?? 0);
  const to = new Date(today.body?.range?.to ?? 0);
  check(
    from.getUTCHours() === 21 && from.getUTCMinutes() === 0,
    'Gün 21:00 UTC’de başlıyor (UTC+3)',
    from.toISOString(),
  );
  check(
    to.getUTCHours() === 20 && to.getUTCMinutes() === 59,
    'Gün 20:59 UTC’de bitiyor',
    to.toISOString(),
  );
  // A whole day, to the millisecond. An off-by-one-second boundary silently
  // drops or double-counts the last visit of the evening.
  const span = to.getTime() - from.getTime();
  check(span === 86_400_000 - 1, 'Aralık tam bir gün', `${span} ms`);

  check(today.body?.daily?.length === 1, 'Grafik tek gün çiziyor', `${today.body?.daily?.length}`);
  check(today.body?.daily?.[0]?.date === day, 'Çizilen gün bugün', String(today.body?.daily?.[0]?.date));

  console.log('\nG. Analytics — yeni boyutlar');
  const month = await api('/analytics/summary?tenant=nexuva');
  check(Array.isArray(month.body?.browsers), 'Tarayıcı kırılımı');
  check(Array.isArray(month.body?.countries), 'Ülke kırılımı');
  check(Array.isArray(month.body?.landingPages), 'Giriş sayfaları');
  check(typeof month.body?.averageScroll === 'number', 'Ortalama kaydırma');
  check(Array.isArray(month.body?.campaigns), 'Kampanya raporu korunuyor');
  check(Array.isArray(month.body?.daily) && month.body.daily.length === 30, 'Varsayılan 30 gün', `${month.body?.daily?.length}`);

  if ((month.body?.landingPages ?? []).length > 0) {
    console.log(
      `  ·  en çok giriş: ${month.body.landingPages[0].path} (${month.body.landingPages[0].visits})`,
    );
  }

  // Leave the setting as it was found.
  if (original !== 'Europe/Istanbul') {
    await api('/website/preferences?tenant=nexuva', {
      method: 'PUT',
      body: JSON.stringify({ timezone: original }),
    });
  }

  report();
}

function report() {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${passed} geçti, ${failed} kaldı`);
  console.log(failed === 0 ? '✅ FAZ E–G canlı doğrulandı.\n' : '❌ Eksik var.\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
