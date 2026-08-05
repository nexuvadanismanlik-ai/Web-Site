#!/usr/bin/env node
/**
 * Faz 4'ün canlı kabulü. Altı senaryoyu uçtan uca çalıştırır:
 *
 *   1. Site formu   → CRM'de talep
 *   2. Yeni talep    → Bildirim
 *   3. Drag & Drop   → Veritabanında durum
 *   4. Not           → Aktivite akışı
 *   5. Atama         → Atanan kişiye bildirim
 *   6. Dashboard sayaçları
 *
 * Ekranların çalıştığını değil, ekranların arkasındaki zincirin çalıştığını
 * kanıtlar: tarayıcının yaptığı çağrıların aynısını yapar ve her adımın izini
 * veritabanından okunan cevapta arar. Sürükle-bırak testi, tahtanın bıraktığı
 * yerde çağırdığı ucun ta kendisidir.
 *
 *   VERIFY_API_URL=https://nexuva-api.onrender.com/api/v1 \
 *   VERIFY_ADMIN_EMAIL=... VERIFY_ADMIN_PASSWORD=... VERIFY_ALLOW_WRITES=1 \
 *   node scripts/verify-crm.mjs
 *
 * YAZAR. Bir test talebi oluşturur, üzerinde çalışır ve sonunda ARŞİV'e taşır —
 * silmez. Talepler müşteri kaydıdır ve bu betiğin bıraktığı iz de bir kayıttır;
 * arşiv onu hattın dışına çıkarır, geçmişi yok etmeden.
 */

const API = (process.env.VERIFY_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? '';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? '';

if (!EMAIL || !PASSWORD) {
  console.error('VERIFY_ADMIN_EMAIL ve VERIFY_ADMIN_PASSWORD gerekli.');
  process.exit(2);
}

if (!process.env.VERIFY_ALLOW_WRITES) {
  console.error(
    'Bu betik gerçek bir talep oluşturur ve bildirim üretir.\n' +
      'Kayıtlar silinmez, sonunda arşive taşınır.\n' +
      'Kabul ediyorsan VERIFY_ALLOW_WRITES=1 ile çalıştır.',
  );
  process.exit(2);
}

let failures = 0;
let total = 0;

function check(name, ok, detail) {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'HATA'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function unwrap(body) {
  if (body !== null && typeof body === 'object' && 'success' in body && 'data' in body) {
    return body.data;
  }
  return body;
}

async function call(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(body)?.slice(0, 300)}`);
  }
  return unwrap(body);
}

const login = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const auth = { Authorization: `Bearer ${login.accessToken}` };

console.log(`API  ${API}\n`);

const STAMP = Date.now().toString(36);
const NAME = `CRM Doğrulama ${STAMP}`;
const EMAIL_ADDR = `crm-verify-${STAMP}@nexuva.test`;

let leadId = null;

try {
  // ── 1. Site formu → CRM ───────────────────────────────────────────────────
  // Ziyaretçinin gönderdiği alanların aynısı, kimliksiz — formun kullandığı yol.
  const before = await call('/website/contact/pipeline/summary', { headers: auth });

  await call('/website/contact', {
    method: 'POST',
    body: JSON.stringify({
      name: NAME,
      email: EMAIL_ADDR,
      phone: '+90 555 000 00 00',
      company: 'Doğrulama A.Ş.',
      service: 'SEO',
      budget: '25.000 - 50.000 TL',
      subject: 'Uçtan uca doğrulama',
      message: 'Bu kayıt scripts/verify-crm.mjs tarafından oluşturuldu.',
      consent: true,
    }),
  });

  const list = await call('/website/contact?limit=100&sortBy=createdAt&sortOrder=desc', {
    headers: auth,
  });
  const found = (list.items ?? []).find((item) => item.email === EMAIL_ADDR);
  check('1. Site formundan gelen talep CRM listesinde', Boolean(found), found?.name);
  if (!found) throw new Error('Talep CRM listesinde bulunamadı; sonraki adımlar anlamsız.');
  leadId = found.id;

  check(
    '1b. Form alanları kaydedilmiş (firma, hizmet, bütçe)',
    found.company === 'Doğrulama A.Ş.' && found.service === 'SEO' && Boolean(found.budget),
    `${found.company} / ${found.service} / ${found.budget}`,
  );
  check('1c. Talep numarası verilmiş', Number.isInteger(found.requestNo), `#${found.requestNo}`);
  check('1d. Hat başlangıcında', found.status === 'NEW', found.status);

  // ── 2. CRM → Notification ─────────────────────────────────────────────────
  const notifications = await call('/notifications?limit=50', { headers: auth });
  const items = notifications.items ?? notifications;
  const newLeadNote = (Array.isArray(items) ? items : []).find((n) =>
    (n.title ?? '').includes(NAME),
  );
  check('2. Yeni talep bildirimi düşmüş', Boolean(newLeadNote), newLeadNote?.title);
  check(
    '2b. Bildirim talebe bağlı',
    newLeadNote?.metadata?.leadId === leadId,
    newLeadNote?.metadata?.leadId ?? '(bağ yok)',
  );

  // ── 3. Drag & Drop → DB ───────────────────────────────────────────────────
  // Kartı bırakınca tahtanın çağırdığı ucun aynısı.
  await call(`/website/contact/${leadId}/status`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'PROPOSAL_SENT' }),
  });
  const afterDrop = await call(`/website/contact/${leadId}/detail`, { headers: auth });
  check('3. Sürükle-bırak durumu veritabanına yazıyor', afterDrop.status === 'PROPOSAL_SENT', afterDrop.status);
  check(
    '3b. Durum değişikliği aktiviteye düşüyor',
    (afterDrop.activities ?? []).some((a) => a.type === 'STATUS_CHANGED'),
    (afterDrop.activities ?? []).find((a) => a.type === 'STATUS_CHANGED')?.description,
  );

  const counts = await call('/website/contact/pipeline/counts', { headers: auth });
  check('3c. Kolon sayacı yeni durumu sayıyor', (counts.PROPOSAL_SENT ?? 0) >= 1, `PROPOSAL_SENT=${counts.PROPOSAL_SENT}`);

  // ── 4. Note → Activity ────────────────────────────────────────────────────
  const noteBody = `Doğrulama notu ${STAMP}`;
  const afterNote = await call(`/website/contact/${leadId}/notes`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ body: noteBody }),
  });
  check(
    '4. Not kaydediliyor',
    (afterNote.notes ?? []).some((n) => n.body === noteBody),
    `${(afterNote.notes ?? []).length} not`,
  );
  check(
    '4b. Not aktivite akışında görünüyor',
    (afterNote.activities ?? []).some((a) => a.type === 'NOTE_ADDED'),
    (afterNote.activities ?? []).find((a) => a.type === 'NOTE_ADDED')?.description,
  );
  check(
    '4c. Aktivite kimin yaptığını biliyor',
    Boolean((afterNote.activities ?? []).find((a) => a.type === 'NOTE_ADDED')?.actor),
    (afterNote.activities ?? []).find((a) => a.type === 'NOTE_ADDED')?.actor?.email,
  );

  // ── 5. Assignment → Notification ──────────────────────────────────────────
  //
  // Atama bildirimi ATANAN kişinin kutusuna düşer, atayanın değil. Tek hesapla
  // giriş yapıldığında o kutu okunamaz — ve okunamayan bir şeyi "doğrulandı"
  // saymak, bu betiğin var olma sebebine aykırı. İkinci hesap verilirse zincir
  // uçtan uca kapanır: B atar, A kendi kutusunda görür.
  const assignees = await call('/website/contact/pipeline/assignees', { headers: auth });
  check('5. Atanabilecek kullanıcı listesi geliyor', assignees.length > 0, `${assignees.length} kişi`);

  const me = login.user?.id;
  const other = assignees.find((person) => person.id !== me);

  // Önce kendine atama: yazma ve aktivite burada kanıtlanır, üstelik kendine
  // atayana bildirim GİTMEMESİ de doğrulanması gereken bir davranış.
  const notesBeforeSelf = await call('/notifications', { headers: auth });
  const beforeSelfCount = (Array.isArray(notesBeforeSelf) ? notesBeforeSelf : notesBeforeSelf.items ?? [])
    .filter((n) => n.metadata?.leadId === leadId).length;

  const afterSelf = await call(`/website/contact/${leadId}/assign`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ userId: me }),
  });
  check('5b. Atama yazılıyor', afterSelf.assignedTo?.id === me, afterSelf.assignedTo?.email);
  check(
    '5c. Atama aktiviteye düşüyor',
    (afterSelf.activities ?? []).some((a) => a.type === 'ASSIGNED'),
    (afterSelf.activities ?? []).find((a) => a.type === 'ASSIGNED')?.description,
  );

  const notesAfterSelf = await call('/notifications', { headers: auth });
  const afterSelfCount = (Array.isArray(notesAfterSelf) ? notesAfterSelf : notesAfterSelf.items ?? [])
    .filter((n) => n.metadata?.leadId === leadId).length;
  check(
    '5d. Kendine atama kendine bildirim üretmiyor',
    afterSelfCount === beforeSelfCount,
    `${beforeSelfCount} → ${afterSelfCount}`,
  );

  // Sonra başkasına atama ve o kişinin kutusunu okuma.
  const SECOND_EMAIL = process.env.VERIFY_SECOND_EMAIL ?? '';
  const SECOND_PASSWORD = process.env.VERIFY_SECOND_PASSWORD ?? '';

  if (other && SECOND_EMAIL && SECOND_PASSWORD) {
    const second = await call('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: SECOND_EMAIL, password: SECOND_PASSWORD }),
    });
    const secondAuth = { Authorization: `Bearer ${second.accessToken}` };

    // Atamayı, bildirimi görecek olan hesabın kendisi yapmamalı.
    await call(`/website/contact/${leadId}/assign`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ userId: second.user.id }),
    });

    const inbox = await call('/notifications', { headers: secondAuth });
    const inboxItems = Array.isArray(inbox) ? inbox : (inbox.items ?? []);
    check(
      '5e. Atanan kişiye bildirim gitti',
      inboxItems.some((n) => n.metadata?.leadId === leadId && /atandı/i.test(n.title ?? '')),
      inboxItems.find((n) => n.metadata?.leadId === leadId)?.title,
    );
  } else if (!other) {
    console.log('ATLA  5e. Atama bildirimi — sistemde atanabilecek ikinci kullanıcı yok');
  } else {
    console.log(
      'ATLA  5e. Atama bildirimi — bildirim atanan kişinin kutusuna düşer ve tek\n' +
        '           hesapla okunamaz. VERIFY_SECOND_EMAIL / VERIFY_SECOND_PASSWORD\n' +
        '           verilirse bu zincir de uçtan uca doğrulanır.',
    );
  }

  // ── 6. Dashboard sayaçları ────────────────────────────────────────────────
  const after = await call('/website/contact/pipeline/summary', { headers: auth });
  check('6. Açık talep sayacı arttı', after.open === before.open + 1, `${before.open} → ${after.open}`);
  check('6b. Bu hafta sayacı arttı', after.thisWeek === before.thisWeek + 1, `${before.thisWeek} → ${after.thisWeek}`);
  check(
    '6c. Atanmamış sayacı atamayı gördü',
    after.unassigned <= before.unassigned,
    `${before.unassigned} → ${after.unassigned}`,
  );

  // ── 7. Panelden talep oluşturma ───────────────────────────────────────────
  const manual = await call('/website/contact/leads', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: `Telefon Talebi ${STAMP}`,
      email: `phone-${STAMP}@nexuva.test`,
      message: 'Telefonla gelen talep — doğrulama.',
      source: 'Telefon',
    }),
  });
  check('7. Panelden talep oluşturuluyor', Boolean(manual.id), `#${manual.requestNo}`);
  check(
    '7b. Elle eklendiği aktiviteye yazılıyor',
    (manual.activities ?? []).some((a) => a.type === 'CREATED' && /elle/i.test(a.description ?? '')),
    (manual.activities ?? []).find((a) => a.type === 'CREATED')?.description,
  );

  // Panelden eklenen kayıt da hattın dışına alınır.
  await call(`/website/contact/${manual.id}/status`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'ARCHIVED' }),
  });
} finally {
  // Test kaydı silinmez, arşivlenir: geçmiş silinmez, hat temiz kalır.
  if (leadId) {
    await call(`/website/contact/${leadId}/status`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ status: 'ARCHIVED' }),
    }).catch(() => {});
    console.log(`\nTest talebi arşive alındı: ${leadId}`);
  }
}

console.log(`\n${total - failures}/${total} kontrol geçti.`);
process.exit(failures > 0 ? 1 : 0);
