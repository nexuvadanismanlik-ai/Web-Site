/**
 * The campaign chain, end to end, against the live API.
 *
 * The question this proves the panel can answer: "Google Ads brought 42
 * visitors, 5 enquiries and 2 won customers." Everything below exists to show
 * that the two ends — a visit and a lead — actually join up, rather than each
 * being counted separately and hopefully.
 *
 * Test rows are marked. `utmCampaign` starts with the marker below and the
 * lead's email is on a reserved domain, so the cleanup at the end can find
 * exactly what this script created and nothing a real visitor did.
 *
 *   node scripts/verify-campaign-chain.mjs
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');

const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';

/** Every row this script creates carries this, so cleanup can find them. */
const MARKER = 'zz-test-kampanya';
const STAMP = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const CAMPAIGN = `${MARKER}-${STAMP}`;

let passed = 0;
let failed = 0;

function check(ok, label, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
  return ok;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
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
  console.log(`\nKampanya zinciri — ${API}`);
  console.log(`Test kampanyası: ${CAMPAIGN}\n`);

  // ---- 1. A visitor arrives from an ad --------------------------------
  console.log('1. Reklamdan ziyaret');
  const views = 3;
  let accepted = 0;
  for (let i = 0; i < views; i++) {
    const res = await api('/analytics/collect', {
      method: 'POST',
      body: JSON.stringify({
        path: i === 0 ? '/' : '/hizmetler',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: CAMPAIGN,
        landingPath: '/',
      }),
    });
    if (res.status === 204) accepted++;
    else check(false, `Sayfa görüntüleme ${i + 1}`, `HTTP ${res.status}`);
  }
  check(
    accepted === views,
    `${accepted}/${views} sayfa görüntüleme kabul edildi (utm_source=google)`,
  );

  // The exact payload the live site sends, unknown fields and all. The tracker
  // discards every response, so an endpoint that rejects a field it has not
  // learned about yet stops measurement with nobody to hear it — which is
  // precisely what happened, and why this case is now its own check.
  const beacon = await api('/analytics/collect', {
    method: 'POST',
    body: JSON.stringify({
      path: '/',
      utmCampaign: CAMPAIGN,
      landingPath: '/',
      referrer: 'https://www.google.com/',
      thisFieldDoesNotExistYet: 'x',
    }),
  });
  check(beacon.status === 204, 'Bilinmeyen alan ölçümü durdurmuyor', `HTTP ${beacon.status}`);

  // ---- 2. The same visit sends the form -------------------------------
  console.log('\n2. Aynı ziyaretten form gönderimi');
  const leadEmail = `${MARKER}-${STAMP}@nexuva-test.invalid`;
  const contact = await api('/website/contact?tenant=nexuva', {
    method: 'POST',
    body: JSON.stringify({
      name: 'ZZ Test Kampanya',
      email: leadEmail,
      phone: '05000000000',
      message: 'Otomatik kampanya zinciri testi. Bu kayıt test sonunda silinir.',
      company: 'ZZ Test',
      service: 'Google Ads Yönetimi',
      consent: true,
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: CAMPAIGN,
      landingPath: '/',
    }),
  });
  const created = check(
    contact.status === 201 || contact.status === 200,
    'Talep kaydedildi',
    `HTTP ${contact.status}`,
  );
  const leadId = contact.body?.id ?? null;

  // ---- 3. Log in ------------------------------------------------------
  console.log('\n3. Panel girişi');
  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.body?.accessToken ?? login.body?.token ?? null;
  if (!check(Boolean(token), 'Giriş yapıldı', `HTTP ${login.status}`)) return report();
  const auth = { Authorization: `Bearer ${token}` };

  // ---- 4. The lead knows where it came from ---------------------------
  console.log('\n4. Talep kaynağını taşıyor');
  if (created && leadId) {
    const lead = await api(`/website/contact/${leadId}/detail?tenant=nexuva`, { headers: auth });
    check(lead.body?.utmSource === 'google', 'Talepte kaynak: google', String(lead.body?.utmSource));
    check(lead.body?.utmCampaign === CAMPAIGN, 'Talepte kampanya adı', String(lead.body?.utmCampaign));
    check(lead.body?.landingPath === '/', 'Talepte giriş sayfası', String(lead.body?.landingPath));
  } else {
    check(false, 'Talep oluşmadığı için kaynak kontrol edilemedi');
  }

  // ---- 5. The report joins the two ends -------------------------------
  console.log('\n5. Kampanya raporu iki ucu birleştiriyor');
  const summary = await api('/analytics/summary?tenant=nexuva', { headers: auth });
  const campaigns = summary.body?.campaigns;
  if (!check(Array.isArray(campaigns), 'Rapor kampanya listesi döndürüyor', `HTTP ${summary.status}`)) {
    return report();
  }

  const row = campaigns.find((c) => c.campaign === CAMPAIGN);
  if (check(Boolean(row), 'Test kampanyası raporda görünüyor')) {
    check(row.source === 'google', 'Raporda kaynak: google', String(row.source));
    check(row.visitors >= 1, `Ziyaretçi sayısı: ${row.visitors}`);
    check(row.views >= views, `Görüntüleme sayısı: ${row.views}`);
    check(row.leads >= 1, `Talep sayısı: ${row.leads}`);
    console.log(
      `\n  → "${row.source} / ${row.campaign} → ${row.visitors} ziyaretçi → ` +
        `${row.leads} başvuru → ${row.won} kazanılan"`,
    );
  }

  // ---- 6. Clean up ----------------------------------------------------
  // Test data does not stay in the customer's reports. Audit and publish
  // history is never touched — only what this run created.
  console.log('\n6. Test verisi temizliği');
  if (leadId) {
    const del = await api(`/website/contact/${leadId}?tenant=nexuva`, {
      method: 'DELETE',
      headers: auth,
    });
    check(del.status === 200 || del.status === 204, 'Test talebi silindi', `HTTP ${del.status}`);
  }

  const purge = await api(`/analytics/test-data?tenant=nexuva&campaign=${CAMPAIGN}`, {
    method: 'DELETE',
    headers: auth,
  });
  check(
    purge.status === 200 || purge.status === 204,
    'Test ziyaret kayıtları silindi',
    `HTTP ${purge.status}`,
  );

  report();
}

function report() {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${passed} geçti, ${failed} kaldı`);
  console.log(failed === 0 ? '✅ Kampanya zinciri canlı doğrulandı.\n' : '❌ Zincir kopuk.\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
});
