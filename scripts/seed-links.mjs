/**
 * Creates the `links` section and fills it with the LogiOps destinations.
 *
 * The addresses were checked against the application rather than assumed. Its
 * bundle declares the routes it has, and the only auth routes in it are
 * `/login`, `/ilk-giris/otp` and `/super-admin/login` — there is no public
 * sign-up. New customers arrive through `/super-admin/customer-requests`,
 * which is to say through a person.
 *
 * That is why the application link points at a form on this site and not at
 * the product. Sending an interested forwarder to a login screen they cannot
 * complete is the most expensive kind of dead end: it reads as the product
 * turning them away. The form lands in the CRM next to every other lead, so
 * whoever reviews requests already has an inbox for it.
 *
 * Everything written here is editable at Bağlantılar in the panel. This only
 * ensures the section exists with working values on day one — a section that
 * has never been created renders as `{}`, and every button that reads it
 * hides itself.
 *
 *   node scripts/seed-links.mjs           # dry run
 *   node scripts/seed-links.mjs --write
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';
const WRITE = process.argv.includes('--write');

const APP = 'https://logiops-frontend.onrender.com';

const LINKS = {
  logiopsLogin: {
    url: `${APP}/login`,
    label: { tr: 'Giriş Yap', en: 'Sign In' },
    description: {
      tr: 'Hesabınız varsa operasyon panelinize buradan girin.',
      en: 'Sign in to your operations panel.',
    },
    newTab: true,
    enabled: true,
  },
  logiopsRegister: {
    // On this site on purpose — see the note at the top of this file.
    url: '/logiops/basvuru',
    label: { tr: 'Üyelik Başvurusu Oluştur', en: 'Apply for Access' },
    description: {
      tr: 'Firmanız için erişim talebi bırakın, operasyonunuzu konuşalım.',
      en: 'Request access for your company.',
    },
    newTab: false,
    enabled: true,
  },
  logiopsApp: {
    url: `${APP}/`,
    label: { tr: 'LogiOps’a Git', en: 'Go to LogiOps' },
    description: { tr: '', en: '' },
    newTab: true,
    enabled: true,
  },
};

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

/**
 * Confirms an address answers before it is written into the site.
 *
 * Only the external ones: a path on this site cannot be checked from here
 * because the page may not be deployed yet, and that is exactly the situation
 * this seed runs in.
 */
async function reachable(url) {
  if (!/^https?:\/\//i.test(url)) return { skipped: true };
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return { status: res.status, ok: res.status >= 200 && res.status < 400 };
  } catch (err) {
    return { status: 0, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  console.log(`\nBağlantılar — ${API}\n`);

  for (const [key, target] of Object.entries(LINKS)) {
    const check = await reachable(target.url);
    const mark = check.skipped ? '  ·  ' : check.ok ? '  ✅ ' : '  ❌ ';
    const detail = check.skipped ? 'site içi' : `HTTP ${check.status}`;
    console.log(`${mark}${key.padEnd(16)} ${target.url}  (${detail})`);
    if (!check.skipped && !check.ok) {
      console.log(`\n❌ ${key} yanıt vermiyor — yazılmadı.\n`);
      process.exit(1);
    }
  }

  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const token = login.body?.accessToken ?? login.body?.token;
  if (!token) {
    console.log(`\n❌ giriş yapılamadı (HTTP ${login.status})`);
    process.exit(1);
  }
  auth = { Authorization: `Bearer ${token}` };

  const existing = await api('/website/sections/links?tenant=nexuva');
  const current = existing.body?.data ?? {};
  const alreadySet = Object.keys(current).length > 0;
  console.log(
    `\nMevcut bölüm: ${alreadySet ? Object.keys(current).join(', ') : '(yok — oluşturulacak)'}`,
  );

  if (!WRITE) {
    console.log('\nYazmak için --write ekle.\n');
    return;
  }

  // Merged over whatever is there. If somebody has already set an address by
  // hand this seed must not silently replace it — so existing keys win.
  const merged = { ...LINKS, ...current };

  const saved = await api('/website/sections/links?tenant=nexuva', {
    method: 'PUT',
    body: JSON.stringify(merged),
  });
  console.log(`\n${saved.status === 200 ? '✅' : '❌'} yazıldı (HTTP ${saved.status})`);

  const back = await api('/website/sections/links?tenant=nexuva');
  const after = back.body?.data ?? {};

  const checks = [
    ['giriş adresi yazıldı', Boolean(after.logiopsLogin?.url)],
    ['başvuru adresi yazıldı', Boolean(after.logiopsRegister?.url)],
    ['uygulama adresi yazıldı', Boolean(after.logiopsApp?.url)],
    ['giriş butonu yazılı', Boolean(after.logiopsLogin?.label?.tr)],
    ['başvuru butonu yazılı', Boolean(after.logiopsRegister?.label?.tr)],
    ['giriş açık', after.logiopsLogin?.enabled !== false],
    ['başvuru açık', after.logiopsRegister?.enabled !== false],
  ];

  console.log('');
  let bad = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (!ok) bad++;
  }
  if (bad > 0) {
    console.log('\n❌ Eksik alan var — yayınlanmadı.\n');
    process.exit(1);
  }

  const published = await api('/website/publish?tenant=nexuva', { method: 'POST' });
  console.log(`\nYayın: HTTP ${published.status} — ${published.body?.detail ?? ''}\n`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
