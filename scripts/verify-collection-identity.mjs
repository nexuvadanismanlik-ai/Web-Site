#!/usr/bin/env node
/**
 * Checks that saving a collection keeps the identity of its rows.
 *
 * A whole-collection save used to delete every row and recreate it, so every id
 * changed on every save: editing one service reissued the identity of all of
 * them. Nothing can point at a row that is reissued on each edit — not a
 * version history, not a rollback, not a permalink, not an image attached to a
 * particular item. Everything built on top of the CMS from here on assumes ids
 * survive a save, so it is worth proving rather than assuming.
 *
 *   VERIFY_ADMIN_EMAIL=... VERIFY_ADMIN_PASSWORD=... node scripts/verify-collection-identity.mjs
 *
 * Writes, then restores. It re-saves an existing collection unchanged and, in
 * the reorder check, puts the original order back. Content is left as found —
 * but it does write, so point it at a non-production API when one exists.
 *
 *   VERIFY_API_URL  default http://localhost:4000/api/v1
 */

const API = (process.env.VERIFY_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? '';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? '';

if (!EMAIL || !PASSWORD) {
  console.error('VERIFY_ADMIN_EMAIL ve VERIFY_ADMIN_PASSWORD gerekli.');
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
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(body)?.slice(0, 200)}`);
  return unwrap(body);
}

// ── Sign in ─────────────────────────────────────────────────────────────────
const login = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const auth = { Authorization: `Bearer ${login.accessToken}` };

console.log(`API  ${API}\n`);

/** Sent back the way the admin panel sends it: ids kept, position dropped. */
function toPayload(items) {
  return items.map((item) => {
    const copy = { ...item };
    delete copy.position;
    delete copy.createdAt;
    delete copy.updatedAt;
    delete copy.deletedAt;
    delete copy.tenantId;
    return copy;
  });
}

// ── An unchanged save must not reissue identity ─────────────────────────────
{
  const before = await call('/website/collections/services', { headers: auth });
  const beforeIds = before.map((s) => s.id);

  await call('/website/collections/services', {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify(toPayload(before)),
  });

  const after = await call('/website/collections/services', { headers: auth });
  const afterIds = after.map((s) => s.id);

  check('Değişiklik olmadan kaydetmek id korur', JSON.stringify(beforeIds) === JSON.stringify(afterIds),
    `${beforeIds.length} kayıt, ${afterIds.filter((id) => beforeIds.includes(id)).length} tanesi aynı id`);
  check('  kayıt sayısı değişmedi', before.length === after.length, `${before.length} → ${after.length}`);
}

// ── A reorder must move rows, not replace them ──────────────────────────────
{
  const before = await call('/website/collections/services', { headers: auth });
  if (before.length < 2) {
    console.log('ATLA  Yeniden sıralama kontrolü — en az 2 kayıt gerekiyor');
  } else {
    const original = toPayload(before);
    const swapped = [original[1], original[0], ...original.slice(2)];

    await call('/website/collections/services', {
      method: 'PUT', headers: auth, body: JSON.stringify(swapped),
    });
    const after = await call('/website/collections/services', { headers: auth });

    check('Yeniden sıralama id korur',
      after[0]?.id === before[1]?.id && after[1]?.id === before[0]?.id,
      `ilk iki id yer değiştirdi mi`);
    check('  toplam id kümesi aynı',
      JSON.stringify([...after.map((s) => s.id)].sort()) ===
        JSON.stringify([...before.map((s) => s.id)].sort()));

    // Put it back the way it was found.
    await call('/website/collections/services', {
      method: 'PUT', headers: auth, body: JSON.stringify(original),
    });
    const restored = await call('/website/collections/services', { headers: auth });
    check('  orijinal sıra geri yüklendi',
      JSON.stringify(restored.map((s) => s.id)) === JSON.stringify(before.map((s) => s.id)));
  }
}

// ── Id-less collections match positionally ──────────────────────────────────
// Logos are plain strings in the site's content model, so they arrive without
// an id and can only be paired by position.
{
  const before = await call('/website/collections/logos', { headers: auth });
  if (before.length === 0) {
    console.log('ATLA  Logo kontrolü — kayıt yok');
  } else {
    const beforeIds = before.map((l) => l.id);
    await call('/website/collections/logos', {
      method: 'PUT', headers: auth,
      body: JSON.stringify(before.map((l) => ({ name: l.name }))),
    });
    const after = await call('/website/collections/logos', { headers: auth });
    check('Id taşımayan koleksiyon sıra ile eşleşiyor',
      JSON.stringify(beforeIds) === JSON.stringify(after.map((l) => l.id)),
      `${beforeIds.length} logo`);
  }
}

console.log(`\n${total - failures}/${total} kontrol geçti.`);
if (failures > 0) process.exit(1);
console.log('Koleksiyon kimliği kayıtlar arasında korunuyor.');
