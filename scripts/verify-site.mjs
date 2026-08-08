/**
 * The public site, checked against production.
 *
 * Everything here is something that has actually gone wrong on this project at
 * least once: Turkish letters destroyed in the database, a link whose address
 * was dropped by a repair script, a page added to the navigation before it had
 * any content, metadata that was never set. A check for each, so none of them
 * can come back quietly.
 *
 *   node scripts/verify-site.mjs
 */

const SITE = (
  process.env.VERIFY_SITE_URL ?? 'https://nexuva-web-site-frontend.onrender.com'
).replace(/\/+$/, '');

const PAGES = [
  ['Ana sayfa', '/'],
  ['Hizmetler', '/services'],
  ['LogiOps', '/logiops'],
  ['Hakkımızda', '/about'],
  ['Referanslar', '/references'],
  ['İletişim', '/contact'],
];

const ASSETS = [
  ['robots.txt', '/robots.txt'],
  ['sitemap.xml', '/sitemap.xml'],
  ['manifest', '/manifest.webmanifest'],
];

let passed = 0;
let failed = 0;
const notes = [];

function check(ok, label, detail = '') {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${detail}`}`);
  if (ok) passed++;
  else failed++;
  return ok;
}

async function get(path) {
  const res = await fetch(`${SITE}${path}`, { redirect: 'follow' });
  return { status: res.status, html: await res.text(), headers: res.headers };
}

/** What is between two tags, with the markup stripped. */
function meta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${name}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern);
    if (found) return found[1];
  }
  return '';
}

async function main() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`NEXUVA SİTE DOĞRULAMASI — ${SITE}`);
  console.log(`${'═'.repeat(64)}\n`);

  const pages = new Map();

  // ── 1. Every page answers ───────────────────────────────────────────
  console.log('1. Sayfalar');
  for (const [label, path] of PAGES) {
    const page = await get(path);
    pages.set(path, page);
    check(page.status === 200, `${label} (${path})`, `HTTP ${page.status}`);
  }

  console.log('\n2. Yardımcı dosyalar');
  for (const [label, path] of ASSETS) {
    const asset = await get(path);
    check(asset.status === 200, label, `HTTP ${asset.status}`);
  }

  // ── 3. Turkish ──────────────────────────────────────────────────────
  // The failure this project has already had, live, on every page.
  console.log('\n3. Türkçe karakterler');
  let totalBroken = 0;
  for (const [label, path] of PAGES) {
    const page = pages.get(path);
    if (!page || page.status !== 200) continue;
    const broken = (page.html.match(/�/g) ?? []).length;
    totalBroken += broken;
    check(broken === 0, `${label}: bozuk karakter yok`, `${broken} adet`);
  }
  const home = pages.get('/');
  check(
    /[çğıİöşüÇĞÖŞÜ]/.test(home?.html ?? ''),
    'Sayfada gerçekten Türkçe karakter var',
    'hiç bulunamadı — içerik boş olabilir',
  );
  check(
    /charset=["']?utf-8/i.test(home?.html ?? ''),
    'Sayfa UTF-8 olarak işaretli',
  );

  // ── 4. Links resolve ────────────────────────────────────────────────
  // A repair script once dropped an href and the home page stopped
  // building. An empty href renders as a link to the current page, which
  // looks fine and does nothing.
  console.log('\n4. Bağlantılar');
  const emptyHrefs = (home?.html.match(/href=["']["']/g) ?? []).length;
  check(emptyHrefs === 0, 'Boş href yok', `${emptyHrefs} adet`);
  check(
    !(home?.html ?? '').includes('href="undefined"'),
    'undefined adresli bağlantı yok',
  );
  check((home?.html ?? '').includes('/logiops'), 'LogiOps menüde');

  // ── 5. LogiOps has content ──────────────────────────────────────────
  // It was in the navigation for a while with an empty page behind it.
  console.log('\n5. LogiOps sayfası');
  const logiops = pages.get('/logiops');
  check(
    !(logiops?.html ?? '').includes('Bu sayfa henüz hazırlanmadı'),
    'Sayfa dolu',
    'içerik girilmemiş',
  );
  check(
    (logiops?.html ?? '').includes('Operasyon') || (logiops?.html ?? '').length > 30_000,
    'Ürün içeriği yüklenmiş',
  );

  // ── 6. Metadata ─────────────────────────────────────────────────────
  console.log('\n6. Meta veriler');
  for (const [label, path] of PAGES) {
    const page = pages.get(path);
    if (!page || page.status !== 200) continue;
    const title = (page.html.match(/<title[^>]*>([^<]*)<\/title>/i) ?? [])[1] ?? '';
    const description = meta(page.html, 'description');
    const ok = title.trim().length > 3 && description.trim().length > 20;
    check(ok, `${label}: title + description`, `title="${title}" desc=${description.length} krkt`);
  }
  check(Boolean(meta(home?.html ?? '', 'og:title')), 'OpenGraph başlığı');
  check(Boolean(meta(home?.html ?? '', 'og:image')), 'OpenGraph görseli');
  check(Boolean(meta(home?.html ?? '', 'twitter:card')), 'Twitter kartı');
  check(/<link[^>]+rel=["']canonical["']/i.test(home?.html ?? ''), 'Canonical');
  check(/<link[^>]+rel=["'](icon|shortcut icon)["']/i.test(home?.html ?? ''), 'Favicon');

  // ── 7. The design system actually shipped ───────────────────────────
  console.log('\n7. Tasarım sistemi');
  // next/font self-hosts and renames the family, so the word 'Playfair' never
  // reaches the HTML. What does reach it is the variable and the display class.
  check(
    /--font-heading/.test(home?.html ?? '') && /display-1|display-2/.test(home?.html ?? ''),
    'Serif başlık sistemi yayında',
    'display-* sınıfları bulunamadı — eski derleme olabilir',
  );
  check(
    (home?.html ?? '').includes('--gold') || (home?.html ?? '').includes('#d9b380'),
    'Marka altını tanımlı',
  );

  // ── 8. Responsive hazards ───────────────────────────────────────────
  // Not a rendering test — that needs a browser. These are the two things
  // that can be read off the HTML and that have bitten this site before.
  console.log('\n8. Mobil');
  check(
    /<meta[^>]+name=["']viewport["']/i.test(home?.html ?? ''),
    'Viewport meta etiketi',
  );
  // Decorative blurs sit inside overflow-hidden sections and cannot scroll the
  // page. The first version of this check reported one as a hazard, which is
  // the kind of false alarm that gets a whole check ignored — so only widths
  // on elements that are not absolutely positioned decoration count.
  const fixedWide = [...(home?.html ?? '').matchAll(/class="([^"]*w-\[(\d{3,})px\][^"]*)"/g)]
    .filter((match) => !/absolute|pointer-events-none/.test(match[1] ?? ''))
    .map((match) => Number(match[2]))
    .filter((width) => width > 360);
  check(
    fixedWide.length === 0,
    'Dar ekranı aşan sabit genişlik yok',
    `${fixedWide.length} adet: ${[...new Set(fixedWide)].join(', ')}px`,
  );

  // ── 9. Weight ───────────────────────────────────────────────────────
  console.log('\n9. Ağırlık');
  const homeKb = Math.round((home?.html.length ?? 0) / 1024);
  check(homeKb < 250, `Ana sayfa HTML ${homeKb} KB`, 'çok büyük');
  notes.push(`Ana sayfa HTML: ${homeKb} KB`);

  // ── Summary ─────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`${passed} geçti, ${failed} kaldı`);
  if (totalBroken > 0) {
    console.log(`\n⚠  Toplam ${totalBroken} bozuk karakter — kaynağı veritabanıdır.`);
  }
  for (const note of notes) console.log(`   ${note}`);
  console.log(failed === 0 ? '\n✅ Site canlı doğrulandı.\n' : '\n❌ Eksik var.\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
