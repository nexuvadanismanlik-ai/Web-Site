/**
 * The LogiOps membership application, exercised against production.
 *
 * The page rendering a form proves nothing — this project has already shipped a
 * contact form that posted to a 404 and lost every enquiry silently, and a
 * validation pipe that rejected every submission while the code looked right.
 * So this submits a real application through the real endpoint and then goes
 * looking for it in the CRM.
 *
 * Every record it creates is marked `zz-test-` and deleted before it exits.
 * The marker is there for the case the delete fails: a leftover row should be
 * unmistakable at a glance rather than something that looks like a lead.
 *
 *   node scripts/verify-logiops-flow.mjs
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';

const MARK = `zz-test-logiops-${Math.random().toString(36).slice(2, 8)}`;

let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${detail}`}`);
  if (ok) passed++;
  else failed++;
  return ok;
}

async function json(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`LOGIOPS BAŞVURU AKIŞI — ${API}`);
  console.log(`${'═'.repeat(64)}\n`);

  // ── 1. The destinations the site will send people to ────────────────
  console.log('1. Bağlantı bölümü');
  const section = await json('/website/content?tenant=nexuva');
  const content = section.body?.data?.data ?? section.body?.data ?? section.body ?? {};
  const links = content.links ?? {};
  check(Boolean(links.logiopsLogin?.url), 'Giriş adresi tanımlı', 'links bölümü boş');
  check(Boolean(links.logiopsRegister?.url), 'Başvuru adresi tanımlı');
  check(links.logiopsLogin?.enabled !== false, 'Giriş bağlantısı açık');
  check(links.logiopsRegister?.enabled !== false, 'Başvuru bağlantısı açık');

  const loginUrl = links.logiopsLogin?.url ?? '';
  if (loginUrl) {
    const reach = await fetch(loginUrl, { redirect: 'follow' })
      .then((r) => r.status)
      .catch(() => 0);
    check(reach >= 200 && reach < 400, 'Giriş adresi yanıt veriyor', `HTTP ${reach}`);
  }

  // ── 2. A real submission ────────────────────────────────────────────
  console.log('\n2. Başvuru gönderimi');
  const submitted = await json('/website/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      name: `zz-test Yetkili ${MARK}`,
      email: `${MARK}@example.com`,
      phone: '+90 555 000 0000',
      company: `zz-test Lojistik A.Ş. (${MARK})`,
      subject: `LogiOps başvurusu — zz-test (${MARK})`,
      service: 'LogiOps Üyelik Başvurusu',
      message:
        'Faaliyet alanı: Hava kargo\nEkip büyüklüğü: 6–20 kullanıcı\n' +
        'IATA acente kodu: 00-0-0000\n\nzz-test otomatik doğrulama kaydı.',
      consent: true,
      website: '',
      landingPath: '/logiops/basvuru',
    }),
  });
  if (!check(submitted.status === 201, 'Başvuru kabul edildi', `HTTP ${submitted.status}`)) {
    console.log(`\n${JSON.stringify(submitted.body).slice(0, 400)}\n`);
    process.exit(1);
  }

  // ── 3. It reached the CRM ───────────────────────────────────────────
  console.log('\n3. CRM’e düşüş');
  const auth = await json('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = auth.body?.data?.accessToken ?? auth.body?.accessToken;
  if (!check(Boolean(token), 'Panele giriş yapıldı', `HTTP ${auth.status}`)) process.exit(1);
  const headers = { Authorization: `Bearer ${token}` };

  const list = await json(
    `/website/contact?limit=20&search=${encodeURIComponent(MARK)}`,
    { headers },
  );
  const rows = list.body?.data?.data ?? list.body?.data ?? [];
  const lead = (Array.isArray(rows) ? rows : []).find((row) =>
    String(row.email ?? '').includes(MARK),
  );
  if (!check(Boolean(lead), 'Talep listede görünüyor')) process.exit(1);

  check(lead.service === 'LogiOps Üyelik Başvurusu', 'LogiOps başvurusu olarak etiketli');
  check(String(lead.company ?? '').includes(MARK), 'Firma adı kaydedilmiş');
  check(String(lead.message ?? '').includes('IATA acente kodu'), 'Operasyon profili mesajda');
  check(Boolean(lead.requestNo), 'Talep numarası verilmiş');

  // Consent is read from the detail, not the list. The list projection leaves
  // it out on purpose and an earlier version of this script called that a
  // missing consent record — a check that reports a fault in the endpoint it
  // is querying rather than in the thing it is testing.
  const detail = await json(`/website/contact/${lead.id}`, { headers });
  const record = detail.body?.data ?? detail.body ?? {};
  check(Boolean(record.consentAt), 'KVKK onayı zaman damgasıyla kaydedilmiş');
  check(record.landingPath === '/logiops/basvuru', 'Başvuru sayfasından geldiği kayıtlı');

  // ── 4. Cleanup ──────────────────────────────────────────────────────
  console.log('\n4. Temizlik');
  const removed = await json(`/website/contact/${lead.id}`, { method: 'DELETE', headers });
  check(removed.status === 200 || removed.status === 204, 'Test kaydı silindi', `HTTP ${removed.status}`);

  const after = await json(
    `/website/contact?limit=20&search=${encodeURIComponent(MARK)}`,
    { headers },
  );
  const leftovers = (after.body?.data?.data ?? after.body?.data ?? []).filter((row) =>
    String(row.email ?? '').includes(MARK),
  );
  check(leftovers.length === 0, 'Hiç test kaydı kalmadı', `${leftovers.length} kayıt kaldı`);

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`${passed} geçti, ${failed} kaldı`);
  console.log(failed === 0 ? '\n✅ Başvuru akışı canlı doğrulandı.\n' : '\n❌ Eksik var.\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
