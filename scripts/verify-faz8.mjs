/**
 * The rest of Faz 8, against the live API.
 *
 * The campaign chain has its own script. This covers the three things that
 * were added around it: date ranges on the reports, knowing where a media file
 * is used before deleting it, and being able to see what a publish changed.
 *
 *   node scripts/verify-faz8.mjs
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');

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

let auth = {};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...auth, ...(options.headers ?? {}) },
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

function day(offset) {
  return new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  console.log(`\nFaz 8 — ${API}\n`);

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.body?.accessToken ?? login.body?.token;
  if (!check(Boolean(token), 'Panel girişi', `HTTP ${login.status}`)) return report();
  auth = { Authorization: `Bearer ${token}` };

  // ---- Date ranges ----------------------------------------------------
  console.log('\n1. Tarih aralığı');

  const today = await api(`/analytics/summary?tenant=nexuva&from=${day(0)}&to=${day(0)}`);
  check(today.status === 200, 'Bugün aralığı okunuyor', `HTTP ${today.status}`);
  check(today.body?.range?.days === 1, 'Bugün = 1 gün', String(today.body?.range?.days));
  check(
    Array.isArray(today.body?.daily) && today.body.daily.length === 1,
    'Grafik tek gün çiziyor',
    `${today.body?.daily?.length} gün`,
  );
  // The end of a range has to be the end of that day. A naive `<= midnight`
  // silently excludes every visit made today, which looks exactly like no
  // traffic — the failure this assertion exists to catch.
  check(
    (today.body?.range?.to ?? '').includes('23:59'),
    'Aralık günün sonunda bitiyor',
    String(today.body?.range?.to),
  );

  const week = await api(`/analytics/summary?tenant=nexuva&from=${day(6)}&to=${day(0)}`);
  check(week.body?.range?.days === 7, '7 günlük aralık', String(week.body?.range?.days));
  check(week.body?.daily?.length === 7, 'Grafik 7 gün çiziyor', `${week.body?.daily?.length}`);
  check(
    (week.body?.views?.selected ?? -1) >= (today.body?.views?.selected ?? 0),
    'Geniş aralık dar aralıktan az değil',
  );

  const yesterday = await api(`/analytics/summary?tenant=nexuva&from=${day(1)}&to=${day(1)}`);
  check(
    yesterday.body?.daily?.[0]?.date === day(1),
    'Dün aralığı dünü gösteriyor',
    String(yesterday.body?.daily?.[0]?.date),
  );

  const junk = await api('/analytics/summary?tenant=nexuva&from=abc&to=xyz');
  check(junk.status === 200, 'Bozuk tarih hata vermiyor, aya düşüyor', `HTTP ${junk.status}`);

  // ---- Media usage ----------------------------------------------------
  console.log('\n2. Medya: kullanıldığı yer');

  const media = await api('/storage/files?tenant=&limit=100');
  const files = media.body?.files ?? [];
  if (!check(Array.isArray(files), 'Medya listesi okunuyor', `HTTP ${media.status}`)) {
    return report();
  }

  check(
    files.length === 0 || files.every((f) => Array.isArray(f.usedAt)),
    'Her dosya kullanım bilgisi taşıyor',
  );

  const inUse = files.find((f) => (f.usedAt?.length ?? 0) > 0);
  if (files.length === 0) {
    console.log('  ·  Kütüphane boş — silme koruması denenemedi.');
  } else if (inUse) {
    check(true, `Kullanımda dosya bulundu: ${inUse.usedAt.map((u) => u.label).join(', ')}`);

    // The protection itself: deleting a file that is on the site must fail
    // without force. Nothing is actually deleted here — a 409 is the pass.
    const blocked = await api(`/storage/files/${inUse.id}`, { method: 'DELETE' });
    check(
      blocked.status === 409,
      'Kullanımdaki dosya force olmadan silinmiyor',
      `HTTP ${blocked.status}`,
    );
    check(
      Array.isArray(blocked.raw?.usedAt ?? blocked.raw?.message?.usedAt) ||
        JSON.stringify(blocked.raw ?? '').includes('kullanılıyor'),
      'Reddederken nerede kullanıldığını söylüyor',
    );

    const still = await api('/storage/files?tenant=&limit=100');
    check(
      (still.body?.files ?? []).some((f) => f.id === inUse.id),
      'Reddedilen silme dosyaya dokunmadı',
    );
  } else {
    console.log('  ·  Hiçbir dosya sitede kullanılmıyor — silme koruması denenemedi.');
  }

  // ---- Publish diff ---------------------------------------------------
  console.log('\n3. Yayın: ne değişti');

  const versions = await api('/website/versions?tenant=nexuva&limit=5');
  const list = versions.body ?? [];
  if (!check(Array.isArray(list) && list.length > 0, 'Sürüm geçmişi okunuyor')) return report();

  const live = list.find((v) => v.isPublished) ?? list[0];

  const vsDraft = await api(`/website/versions/diff?from=${live.number}&tenant=nexuva`);
  check(vsDraft.status === 200, 'Yayındaki sürüm taslakla karşılaştırılıyor', `HTTP ${vsDraft.status}`);
  check(Array.isArray(vsDraft.body?.changes), 'Değişiklik listesi dönüyor');
  check(typeof vsDraft.body?.total === 'number', 'Toplam değişiklik sayısı dönüyor');
  console.log(
    `  ·  Taslakta ${vsDraft.body?.total ?? '?'} değişiklik` +
      (vsDraft.body?.changes?.[0] ? ` — ilki: ${vsDraft.body.changes[0].label}` : ''),
  );

  if (list.length > 1) {
    const older = list[1];
    const between = await api(
      `/website/versions/diff?from=${older.number}&to=${live.number}&tenant=nexuva`,
    );
    check(between.status === 200, 'İki sürüm karşılaştırılıyor', `HTTP ${between.status}`);
    check(
      between.body?.from === older.number && between.body?.to === live.number,
      'Karşılaştırma doğru sürümleri raporluyor',
    );

    // A version compared with itself must be empty. If this reports changes,
    // the walker is finding differences that are not there and every other
    // number it produces is noise.
    const same = await api(
      `/website/versions/diff?from=${live.number}&to=${live.number}&tenant=nexuva`,
    );
    check(
      same.body?.changes?.length === 0,
      'Sürüm kendisiyle karşılaştırılınca fark yok',
      `${same.body?.changes?.length} fark bulundu`,
    );
  }

  const missing = await api('/website/versions/diff?from=99999&tenant=nexuva');
  check(missing.status === 404, 'Olmayan sürüm 404 veriyor', `HTTP ${missing.status}`);

  // ---- Mail templates -------------------------------------------------
  console.log('\n4. Mail şablonları');

  const templates = await api('/mail/templates?tenant=nexuva');
  // The endpoint answers { templates, variables } — the panel needs both.
  const rows = templates.body?.templates ?? [];
  if (!check(Array.isArray(rows), 'Şablon listesi okunuyor', `HTTP ${templates.status}`)) {
    return report();
  }
  const keys = rows.map((t) => t.key);
  check(keys.includes('deal_won'), 'Kazanıldı şablonu var');
  check(keys.includes('deal_lost'), 'Kapanış şablonu var');
  const lost = rows.find((t) => t.key === 'deal_lost');
  check(
    lost?.enabled === false,
    'Kapanış şablonu varsayılan olarak kapalı',
    String(lost?.enabled),
  );

  report();
}

function report() {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${passed} geçti, ${failed} kaldı`);
  console.log(failed === 0 ? '✅ Faz 8 canlı doğrulandı.\n' : '❌ Eksik var.\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
});
