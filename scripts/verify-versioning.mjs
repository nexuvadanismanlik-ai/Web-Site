#!/usr/bin/env node
/**
 * Checks that draft and published are genuinely two different things.
 *
 * The whole point of versioning is that saving an edit does not change what
 * visitors see. That is easy to claim and easy to get subtly wrong — a shared
 * read path, a snapshot taken after the deploy rather than before, a rollback
 * that re-points a marker without moving the draft. Each of those compiles
 * fine and each of them silently defeats the feature.
 *
 *   VERIFY_ADMIN_EMAIL=... VERIFY_ADMIN_PASSWORD=... node scripts/verify-versioning.mjs
 *
 * WRITES, AND PUBLISHES FOUR TIMES. It restores the hero text it changes, but
 * each publish appends a content version and a publish log entry, and on the
 * deploy-hook strategy triggers a real rebuild.
 *
 * Local development currently points DATABASE_URL at the production Supabase,
 * so "run it locally" is not the same as "run it somewhere harmless" — running
 * this fills the real publish history with test entries. Set VERIFY_ALLOW_WRITES
 * to acknowledge that before it will run.
 *
 *   VERIFY_API_URL      default http://localhost:4000/api/v1
 *   VERIFY_ALLOW_WRITES required — set to 1
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
    'Bu betik 4 kez yayın yapar ve yayın geçmişine test kaydı ekler.\n' +
      'Yerel geliştirme üretim veritabanına bağlı olduğu için bu kayıtlar gerçek\n' +
      'geçmişe düşer. Kabul ediyorsan VERIFY_ALLOW_WRITES=1 ile çalıştır.',
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

const MARKER = `sürüm-testi-${Date.now().toString(36)}`;

// The hero section is a singleton JSON document; its badge is a small,
// self-contained field to move without disturbing anything meaningful.
const heroBefore = await call('/website/sections/hero', { headers: auth });
const original = JSON.parse(JSON.stringify(heroBefore.data));

async function readHero(state) {
  const doc = await call(`/website/content${state ? `?state=${state}` : ''}`);
  return doc?.hero?.badge?.tr ?? '(yok)';
}

try {
  // ── Publish once, so there is a published baseline to diverge from ────────
  const first = await call('/website/publish', { method: 'POST', headers: auth });
  check('Yayınlama bir sürüm donduruyor', typeof first.version === 'number', `sürüm ${first.version}`);
  const baseline = await readHero('published');

  // ── A save must move the draft and leave the published site alone ─────────
  const edited = { ...original, badge: { ...(original.badge ?? {}), tr: MARKER, en: MARKER } };
  await call('/website/sections/hero', {
    method: 'PUT', headers: auth, body: JSON.stringify(edited),
  });

  const draftAfterSave = await readHero('draft');
  const publishedAfterSave = await readHero('published');

  check('Kaydetmek taslağı değiştiriyor', draftAfterSave === MARKER, draftAfterSave);
  check('Kaydetmek yayındaki siteyi DEĞİŞTİRMİYOR', publishedAfterSave === baseline,
    `yayında: ${publishedAfterSave}`);
  check('  varsayılan okuma yayınlanmış olan', (await readHero()) === baseline);

  // ── Publishing carries the draft across ──────────────────────────────────
  const second = await call('/website/publish', { method: 'POST', headers: auth });
  check('Yayınlamak taslağı siteye taşıyor', (await readHero('published')) === MARKER,
    `sürüm ${second.version}`);
  check('  sürüm numarası ilerledi', second.version === first.version + 1,
    `${first.version} → ${second.version}`);

  // ── History ──────────────────────────────────────────────────────────────
  const history = await call('/website/versions', { headers: auth });
  check('Sürüm geçmişi kayıtlı', Array.isArray(history) && history.length >= 2,
    `${history.length} sürüm`);
  check('  yayındaki sürüm işaretli',
    history.filter((v) => v.isPublished).length === 1 &&
      history.find((v) => v.isPublished)?.number === second.version);
  check('  kim yayınladı kayıtlı', typeof history[0]?.createdBy === 'string' && history[0].createdBy.length > 0,
    history[0]?.createdBy ?? '(yok)');

  // ── Rollback ─────────────────────────────────────────────────────────────
  const restored = await call(`/website/versions/${first.version}/restore`, {
    method: 'POST', headers: auth,
  });
  check('Geri alma yeni bir sürüm üretiyor', restored.number > second.version,
    `sürüm ${restored.number}, kaynak ${restored.restoredFrom}`);
  check('  yayındaki içerik eski hâline döndü', (await readHero('published')) === baseline);
  check('  taslak da geri döndü — ikisi ayrışmıyor', (await readHero('draft')) === baseline);
  check('  geri alma geçmişte işaretli', restored.restoredFrom === first.version);
} finally {
  // Put the hero back the way it was found, in the draft and on the site.
  await call('/website/sections/hero', {
    method: 'PUT', headers: auth, body: JSON.stringify(original),
  });
  await call('/website/publish', { method: 'POST', headers: auth });
}

console.log(`\n${total - failures}/${total} kontrol geçti.`);
if (failures > 0) process.exit(1);
console.log('Taslak ve yayın gerçekten ayrı; geri alma çalışıyor.');
