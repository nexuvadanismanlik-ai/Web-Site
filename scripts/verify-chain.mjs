#!/usr/bin/env node
/**
 * Verifies the chain that carries an edit to a visitor:
 *
 *   Admin panel -> Kaydet -> Supabase -> Backend API -> Frontend build -> Canlı site
 *
 * Every link is checked against the deployed system, because the failures that
 * actually happened here were invisible from inside any single part: a build
 * that succeeded while serving frozen content, a contact route that answered
 * 404, a publish that reported success for a deploy that failed.
 *
 * Read-only by design. It creates nothing and changes nothing, so it is safe to
 * run against production at any time — which is the point, since it is meant to
 * be the acceptance check at the end of every phase.
 *
 *   node scripts/verify-chain.mjs
 *
 * Targets are read from the environment, with the deployed services as the
 * default:
 *   VERIFY_API_URL   default https://web-site-backend-3fvs.onrender.com/api/v1
 *   VERIFY_SITE_URL  default https://nexuva-web-site-frontend.onrender.com
 */

const API = (process.env.VERIFY_API_URL ?? 'https://web-site-backend-3fvs.onrender.com/api/v1')
  .replace(/\/+$/, '');
const SITE = (process.env.VERIFY_SITE_URL ?? 'https://nexuva-web-site-frontend.onrender.com')
  .replace(/\/+$/, '');

/** Render suspends idle instances; a first call can take most of a minute. */
const WAKE_MS = 90_000;

const checks = [];
let failures = 0;

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  if (!ok) failures++;
  const mark = ok ? 'OK  ' : 'HATA';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function get(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WAKE_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The site is HTML, so its text carries entity escapes: a service named
 * "Bulut & DevOps" appears as "Bulut &amp; DevOps". Comparing raw strings made
 * three live services look missing once already — the test was wrong, not the
 * site. Decode before comparing.
 */
function plainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/** Localized values are stored as { tr, en }. */
function tr(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.tr ?? value.en ?? '';
  return '';
}

console.log(`API   ${API}`);
console.log(`Site  ${SITE}\n`);

// ── 1. API is up ────────────────────────────────────────────────────────────
let content = null;
try {
  const res = await get(`${API}/website/content`);
  record('API ayakta ve içerik dönüyor', res.ok, `HTTP ${res.status}`);
  if (res.ok) content = await res.json();
} catch (err) {
  record('API ayakta ve içerik dönüyor', false, String(err));
}

// ── 2. Content actually has the sections the site renders ───────────────────
if (content) {
  const services = Array.isArray(content.services) ? content.services : [];
  const references = Array.isArray(content.references) ? content.references : [];
  record(
    'Supabase içeriği dolu',
    services.length > 0 && references.length > 0,
    `${services.length} hizmet, ${references.length} referans`,
  );
}

// ── 3. The contact route exists ─────────────────────────────────────────────
// Posting a deliberately invalid body: 400 proves the route is mounted and
// validating, 404 is the bug that silently swallowed every enquiry. Nothing is
// written either way.
try {
  const res = await get(`${API}/website/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  record(
    'İletişim formu ucu mevcut',
    res.status !== 404,
    res.status === 404 ? 'HTTP 404 — form talepleri kayboluyor' : `HTTP ${res.status} (doğrulama çalışıyor)`,
  );
} catch (err) {
  record('İletişim formu ucu mevcut', false, String(err));
}

// ── 4. The published site carries what the API holds ────────────────────────
if (content) {
  // Route segments are the English directory names under app/[locale];
  // Faz 2 moves these to Turkish slugs at the site root.
  const pages = [
    { path: '/tr/', items: (content.references ?? []).map((r) => r.name).filter(Boolean) },
    { path: '/tr/services/', items: (content.services ?? []).map((s) => tr(s.title)).filter(Boolean) },
    { path: '/tr/references/', items: (content.references ?? []).map((r) => r.name).filter(Boolean) },
  ];

  for (const page of pages) {
    if (page.items.length === 0) continue;
    try {
      const res = await get(`${SITE}${page.path}`);
      if (!res.ok) {
        record(`Canlı site ${page.path}`, false, `HTTP ${res.status}`);
        continue;
      }
      const text = plainText(await res.text());
      const missing = page.items.filter((item) => !text.includes(item));
      record(
        `Canlı site ${page.path} içeriği eşleşiyor`,
        missing.length === 0,
        missing.length === 0
          ? `${page.items.length}/${page.items.length} eşleşti`
          : `eksik: ${missing.join(', ')}`,
      );
    } catch (err) {
      record(`Canlı site ${page.path}`, false, String(err));
    }
  }
}

// ── 5. Unknown routes must not resolve ──────────────────────────────────────
// A catch-all locale segment used to answer 200 with the Turkish homepage for
// any path, which would have quietly made every typo an indexable duplicate.
try {
  const res = await get(`${SITE}/bilinmeyen-sayfa-kontrolu/`);
  record('Bilinmeyen adres 404 veriyor', res.status === 404, `HTTP ${res.status}`);
} catch (err) {
  record('Bilinmeyen adres 404 veriyor', false, String(err));
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${checks.length - failures}/${checks.length} kontrol geçti.`);
if (failures > 0) {
  console.log('Zincir kopuk — yukarıdaki HATA satırlarına bak.');
  process.exit(1);
}
console.log('Zincir sağlam: panelde kaydedilen içerik canlı sitede görünüyor.');
