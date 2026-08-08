/**
 * Fills the two SEO fields that were never set.
 *
 * `seo.title` and `seo.description` were both empty, so the site fell back to
 * what it could derive. The fallbacks are decent — they were built for exactly
 * this — but they are not what these fields are for:
 *
 *   · The title fell back to "Nexuva — Dijital dönüşümün mimarı". A fine line,
 *     and a search result nobody types. It contains none of the words a person
 *     looking for this company would enter.
 *
 *   · The description fell back to the hero paragraph, which is 250 characters.
 *     Google renders about 155 and cuts the rest mid-sentence, so the snippet
 *     ended on an ellipsis in the middle of the argument.
 *
 * Both replacements are written to be read in a search result rather than on a
 * page: the services named the way people search for them, under the limits, no
 * claim that is not already on the site.
 *
 * Ordinary panel fields — SEO Merkezi → Başlık / Açıklama — so anything here is
 * editable without touching code.
 *
 *   node scripts/repair-seo-copy.mjs           # dry run
 *   node scripts/repair-seo-copy.mjs --write
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';
const WRITE = process.argv.includes('--write');

const TITLE = 'Nexuva Danışmanlık | Dijital Pazarlama, Google Ads ve SEO Ajansı';

const DESCRIPTION =
  'Google Ads, Meta reklam yönetimi, SEO ve kurumsal web sitesi hizmetleri. ' +
  'Lojistik ve dış ticaret firmaları için LogiOps operasyon platformu.';

/**
 * The words this site should be found by.
 *
 * The agency terms were already here. The three logistics ones are new and
 * belong on the site list as well as on the product page: somebody searching
 * for the software should be able to arrive at the company too.
 */
const KEYWORDS = [
  'dijital pazarlama ajansı',
  'google ads yönetimi',
  'meta reklam yönetimi',
  'seo hizmeti',
  'kurumsal web sitesi',
  'landing page tasarımı',
  'dijital marka danışmanlığı',
  'dijital dönüşüm',
  'reklam ajansı İstanbul',
  'lojistik yazılımı',
  'dış ticaret operasyon yazılımı',
  'freight forwarder yazılımı',
];

// What the search engines actually render. Over these, the rest is cut.
const TITLE_LIMIT = 65;
const DESCRIPTION_LIMIT = 160;

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
  console.log(`\nSEO metinleri — ${API}\n`);

  // Checked before anything is written. A description that gets truncated is
  // the problem this script exists to fix, and shipping a new one that is also
  // too long would be a slow way to learn nothing.
  if (TITLE.length > TITLE_LIMIT) {
    console.log(`❌ Başlık ${TITLE.length} karakter, sınır ${TITLE_LIMIT}`);
    process.exit(1);
  }
  if (DESCRIPTION.length > DESCRIPTION_LIMIT) {
    console.log(`❌ Açıklama ${DESCRIPTION.length} karakter, sınır ${DESCRIPTION_LIMIT}`);
    process.exit(1);
  }
  console.log(`  Başlık   : ${TITLE.length} karakter — "${TITLE}"`);
  console.log(`  Açıklama : ${DESCRIPTION.length} karakter`);
  console.log(`  Anahtar  : ${KEYWORDS.length} kelime`);

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

  const section = await api('/website/sections/seo?tenant=nexuva');
  const data = section.body?.data ?? {};

  console.log(`\n  Mevcut başlık   : ${data.title || '(boş)'}`);
  console.log(`  Mevcut açıklama : ${data.description || '(boş)'}`);

  if (!WRITE) {
    console.log('\nYazmak için --write ekle.\n');
    return;
  }

  // Merged. This section also holds the canonical, the card type and the
  // verification codes, and none of them are being changed here.
  const saved = await api('/website/sections/seo?tenant=nexuva', {
    method: 'PUT',
    body: JSON.stringify({
      ...data,
      title: TITLE,
      description: DESCRIPTION,
      keywords: KEYWORDS,
    }),
  });
  console.log(`\n${saved.status === 200 ? '✅' : '❌'} yazıldı (HTTP ${saved.status})`);

  const back = await api('/website/sections/seo?tenant=nexuva');
  const after = back.body?.data ?? {};

  const checks = [
    ['başlık yazıldı', after.title === TITLE],
    ['açıklama yazıldı', after.description === DESCRIPTION],
    ['anahtar kelimeler yazıldı', (after.keywords ?? []).length === KEYWORDS.length],
    ['canonical korundu', after.canonical === data.canonical],
    ['kart tipi korundu', after.twitterCard === data.twitterCard],
    ['noIndex kapalı kaldı', after.noIndex === false],
  ];

  console.log('');
  let bad = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (!ok) bad++;
  }
  if (bad > 0) {
    console.log('\n❌ Beklenmeyen durum — yayınlanmadı.\n');
    process.exit(1);
  }

  const published = await api('/website/publish?tenant=nexuva', { method: 'POST' });
  console.log(`\nYayın: HTTP ${published.status} — ${published.body?.detail ?? ''}\n`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
