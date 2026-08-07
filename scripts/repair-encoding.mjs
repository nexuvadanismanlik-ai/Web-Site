/**
 * Repairs Turkish text that was destroyed on its way into the database.
 *
 * The live site showed "Gelece�in i�ini bug�nden" — every Turkish-specific
 * letter replaced by U+FFFD. The repo is clean and the API serves UTF-8 with
 * the right header, so the damage is in the stored content: something wrote it
 * through a shell whose code page was not UTF-8, and by the time it reached
 * Postgres the original bytes were already gone.
 *
 * U+FFFD is lossy — the byte that produced it cannot be recovered — so this
 * does not "decode" anything. It writes the correct text back.
 *
 * The reason this file exists rather than a one-line curl: passing Turkish
 * through a Windows shell is exactly what broke it in the first place. Written
 * as UTF-8 and run by node, the text never touches a shell.
 *
 *   node scripts/repair-encoding.mjs           (report only)
 *   node scripts/repair-encoding.mjs --write   (repair)
 *   node scripts/repair-encoding.mjs --write --publish
 */

const API = (
  process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1'
).replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? 'nexuva123';

const WRITE = process.argv.includes('--write');
const PUBLISH = process.argv.includes('--publish');

const BAD = '�';
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
 * The correct text.
 *
 * Reconstructed from the damaged strings, whose words were unambiguous. The
 * hero copy is also brought in line with what Nexuva actually does — a digital
 * marketing and transformation agency — since the old wording said "strateji,
 * yazılım ve tasarım" and never mentioned the advertising work that is most of
 * the business. No claim here is a number or a customer; positioning only.
 */
const HERO = {
  badge: {
    tr: 'Kurumsal Dijital Dönüşüm Partneriniz',
    en: 'Your corporate digital transformation partner',
  },
  titleLead: { tr: 'Geleceğin işini bugünden', en: 'Build tomorrow’s business' },
  titleHighlight: { tr: 'birlikte inşa edelim', en: 'together, today' },
  subtitle: {
    tr:
      'Nexuva; dijital pazarlama, reklam yönetimi ve web deneyimini tek çatı altında ' +
      'birleştirir. Google ve Meta reklamlarından SEO’ya, kurumsal web sitesinden ' +
      'dönüşüm ölçümüne kadar markanızın dijitalde büyümesi için gereken her adımda ' +
      'yanınızdayız.',
    en:
      'Nexuva brings digital marketing, advertising and web experience together under ' +
      'one roof — from Google and Meta campaigns to SEO, corporate websites and ' +
      'conversion measurement.',
  },
  primaryCta: { label: { tr: 'Projenizi Konuşalım', en: 'Let’s talk about your project' } },
  secondaryCta: { label: { tr: 'Hizmetleri Keşfet', en: 'Explore our services' } },
};

/** The search terms, spelled correctly. */
const SEO_KEYWORDS = [
  'dijital pazarlama ajansı',
  'google ads yönetimi',
  'meta reklam yönetimi',
  'seo hizmeti',
  'kurumsal web sitesi',
  'dijital marka danışmanlığı',
  'dijital dönüşüm',
];

/** Every damaged string in a document, with where it lives. */
function findDamage(node, path = '', out = []) {
  if (typeof node === 'string') {
    if (node.includes(BAD)) out.push({ path, value: node });
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => findDamage(item, `${path}[${index}]`, out));
    return out;
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      findDamage(node[key], path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

const SECTIONS = [
  'brand',
  'hero',
  'about',
  'cta',
  'contact',
  'footer',
  'seo',
  'uiText',
  'servicesMeta',
  'referencesMeta',
  'testimonialsMeta',
  'processMeta',
  'integrations',
];

async function main() {
  console.log(`\nTürkçe karakter onarımı — ${API}`);
  console.log(WRITE ? 'MOD: yazma\n' : 'MOD: yalnızca rapor (yazmak için --write)\n');

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

  // ── 1. Survey every section, not only the ones already known ────────
  console.log('1. Taslak içerik taranıyor\n');
  const damaged = [];
  for (const key of SECTIONS) {
    const section = await api(`/website/sections/${key}?tenant=nexuva`);
    const hits = findDamage(section.body?.data ?? {});
    if (hits.length > 0) {
      damaged.push({ key, hits });
      console.log(`  ⚠  ${key}: ${hits.length} bozuk metin`);
      for (const hit of hits) {
        console.log(`       ${hit.path} → ${JSON.stringify(hit.value).slice(0, 90)}`);
      }
    }
  }

  // Collections carry text too, and a scan that only looked at sections would
  // pronounce the site clean while a service title was still broken.
  const collections = ['nav-items', 'logos', 'services', 'stats', 'references', 'testimonials', 'process-steps'];
  for (const slug of collections) {
    const rows = await api(`/website/collections/${slug}?tenant=nexuva`);
    const hits = findDamage(rows.body ?? []);
    if (hits.length > 0) {
      damaged.push({ key: `collection:${slug}`, hits });
      console.log(`  ⚠  ${slug}: ${hits.length} bozuk metin`);
      for (const hit of hits.slice(0, 8)) {
        console.log(`       ${hit.path} → ${JSON.stringify(hit.value).slice(0, 90)}`);
      }
    }
  }

  if (damaged.length === 0) {
    console.log('  ✅ Taslakta bozuk karakter yok.\n');
  }

  if (!WRITE) {
    console.log('\nYazmak için: node scripts/repair-encoding.mjs --write\n');
    return;
  }

  // ── 2. Repair ───────────────────────────────────────────────────────
  console.log('\n2. Onarım\n');

  const hero = await api('/website/sections/hero?tenant=nexuva');
  const nextHero = { ...(hero.body?.data ?? {}), ...HERO };
  const heroSaved = await api('/website/sections/hero?tenant=nexuva', {
    method: 'PUT',
    body: JSON.stringify(nextHero),
  });
  console.log(`  ${heroSaved.status === 200 ? '✅' : '❌'} hero yazıldı (HTTP ${heroSaved.status})`);

  const seo = await api('/website/sections/seo?tenant=nexuva');
  const nextSeo = { ...(seo.body?.data ?? {}), keywords: SEO_KEYWORDS };
  const seoSaved = await api('/website/sections/seo?tenant=nexuva', {
    method: 'PUT',
    body: JSON.stringify(nextSeo),
  });
  console.log(`  ${seoSaved.status === 200 ? '✅' : '❌'} seo yazıldı (HTTP ${seoSaved.status})`);

  // ── 3. Verify the write survived the round trip ─────────────────────
  // The whole failure was text being mangled in transit, so reading it back
  // and checking the letters is the only proof that matters.
  console.log('\n3. Geri okuma\n');
  let clean = true;
  for (const key of ['hero', 'seo']) {
    const section = await api(`/website/sections/${key}?tenant=nexuva`);
    const hits = findDamage(section.body?.data ?? {});
    console.log(`  ${hits.length === 0 ? '✅' : '❌'} ${key}: ${hits.length} bozuk metin`);
    if (hits.length > 0) clean = false;
  }

  const heroBack = await api('/website/sections/hero?tenant=nexuva');
  const lead = heroBack.body?.data?.titleLead?.tr ?? '';
  console.log(`\n  Kaydedilen başlık: "${lead}"`);
  console.log(
    lead === HERO.titleLead.tr
      ? '  ✅ Türkçe karakterler gidiş-dönüş korundu'
      : '  ❌ Metin yolda değişti',
  );

  if (!clean) {
    console.log('\n❌ Onarım tamamlanmadı.\n');
    process.exit(1);
  }

  // ── 4. Publish, so the fix reaches visitors ─────────────────────────
  if (PUBLISH) {
    console.log('\n4. Yayınlama\n');
    const published = await api('/website/publish?tenant=nexuva', { method: 'POST' });
    console.log(`  ${published.status < 300 ? '✅' : '❌'} yayın tetiklendi (HTTP ${published.status})`);
    console.log(`  ${published.body?.detail ?? ''}`);
    console.log('\n  Site yeniden derlendikten sonra canlı HTML kontrol edilmeli.');
  } else {
    console.log('\n  Not: yayınlamak için --publish ekle. Taslak düzeldi, canlı site henüz eski.');
  }

  console.log('');
}

main().catch((err) => {
  console.error(`\n❌ ${err.stack ?? err.message}\n`);
  process.exit(1);
});
