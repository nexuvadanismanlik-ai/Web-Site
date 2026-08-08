/**
 * Removes the stale services column from the footer.
 *
 * It listed "Dijital Strateji", "Yazılım Geliştirme" and "Bulut & DevOps" —
 * three things Nexuva does not do. The footer now builds that column from the
 * services themselves, so this only clears the hand-written one out of the
 * content; leaving it would put two "Hizmetler" columns side by side, one real
 * and one wrong.
 *
 *   node scripts/repair-footer.mjs --write
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';
const WRITE = process.argv.includes('--write');

let auth = {};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
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
  return { status: res.status, body: body?.data ?? body };
}

async function main() {
  console.log(`\nFooter temizliği — ${API}\n`);

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.body?.accessToken ?? login.body?.token;
  if (!token) {
    console.log(`❌ giriş yapılamadı (HTTP ${login.status})`);
    process.exit(1);
  }
  auth = { Authorization: `Bearer ${token}` };

  const footer = await api('/website/sections/footer?tenant=nexuva');
  const data = footer.body?.data ?? {};
  const columns = data.columns ?? [];

  console.log('Mevcut sütunlar:');
  for (const column of columns) {
    console.log(`  [${column.title?.tr}] ${(column.links ?? []).map((l) => l.label?.tr).join(', ')}`);
  }

  // The same rule the footer component uses: a column whose links all point at
  // the services page was a hand-written services list.
  const kept = columns.filter((column) => {
    const links = column.links ?? [];
    return links.length === 0 || !links.every((link) => link.href === '/services');
  });

  if (kept.length === columns.length) {
    console.log('\n✅ Kaldırılacak sütun yok.\n');
    return;
  }

  console.log(`\n${columns.length - kept.length} sütun kaldırılacak.`);
  if (!WRITE) {
    console.log('Yazmak için --write ekle.\n');
    return;
  }

  const saved = await api('/website/sections/footer?tenant=nexuva', {
    method: 'PUT',
    // Merged, not replaced. The last repair script on this project dropped a
    // sibling field by rebuilding a nested object from scratch, and broke the
    // home page for an hour.
    body: JSON.stringify({ ...data, columns: kept }),
  });
  console.log(`${saved.status === 200 ? '✅' : '❌'} yazıldı (HTTP ${saved.status})`);

  const back = await api('/website/sections/footer?tenant=nexuva');
  const after = back.body?.data ?? {};
  console.log('\nKalan sütunlar:');
  for (const column of after.columns ?? []) {
    console.log(`  [${column.title?.tr}] ${(column.links ?? []).map((l) => l.label?.tr).join(', ')}`);
  }
  // The other fields have to have survived the merge.
  const intact = Boolean(after.about) && Boolean(after.copyright);
  console.log(intact ? '\n✅ Diğer footer alanları yerinde.' : '\n❌ Bir alan kayboldu.');
  if (!intact) process.exit(1);

  const published = await api('/website/publish?tenant=nexuva', { method: 'POST' });
  console.log(`\nYayın: HTTP ${published.status} — ${published.body?.detail ?? ''}\n`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
