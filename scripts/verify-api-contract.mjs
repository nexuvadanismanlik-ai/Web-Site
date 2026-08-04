#!/usr/bin/env node
/**
 * Checks that the API answers in its declared contract.
 *
 * Success is `{success, message, data}` applied centrally by
 * TransformInterceptor; failure is `{success:false, statusCode, errorCode, ...}`
 * from HttpExceptionFilter. Both halves are verified here against a running
 * instance, because the shape is produced by framework wiring that typechecking
 * cannot see: an interceptor that is registered but not reached, or one that
 * double-wraps a handler which already built its own envelope, both compile.
 *
 *   node scripts/verify-api-contract.mjs
 *
 * Public checks always run and change nothing. The authenticated half runs only
 * when credentials are supplied:
 *
 *   VERIFY_API_URL         default http://localhost:4000/api/v1
 *   VERIFY_ADMIN_EMAIL     optional — enables the authenticated checks
 *   VERIFY_ADMIN_PASSWORD  optional
 */

const API = (process.env.VERIFY_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');
const EMAIL = process.env.VERIFY_ADMIN_EMAIL ?? '';
const PASSWORD = process.env.VERIFY_ADMIN_PASSWORD ?? '';

let failures = 0;
let total = 0;

function check(name, ok, detail) {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'HATA'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** The success half of the contract. */
function isEnvelope(body) {
  return (
    body !== null &&
    typeof body === 'object' &&
    body.success === true &&
    typeof body.message === 'string' &&
    'data' in body
  );
}

console.log(`API  ${API}\n`);

// ── Success shape ───────────────────────────────────────────────────────────
{
  const res = await fetch(`${API}/website/content`);
  const body = await res.json();
  check('GET /website/content zarflı', isEnvelope(body));
  check('  payload bozulmamış', Array.isArray(body?.data?.services));
  // A handler that builds its own envelope on top of the interceptor's would
  // put a second `success` inside `data`. Seven handlers used to do this.
  check('  çift sarmalama yok', body?.data?.success === undefined);
}

// ── Failure shape ───────────────────────────────────────────────────────────
{
  const res = await fetch(`${API}/website/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  check('Doğrulama hatası VALIDATION_FAILED', body?.errorCode === 'VALIDATION_FAILED', `HTTP ${res.status}`);
  check('  success:false', body?.success === false);
  check('  alan hataları korunuyor', Array.isArray(body?.errors?.validation));
}

{
  const res = await fetch(`${API}/website/publish/status`);
  const body = await res.json();
  check('Yetkisiz erişim UNAUTHENTICATED', body?.errorCode === 'UNAUTHENTICATED', `HTTP ${res.status}`);
}

{
  const res = await fetch(`${API}/website/does-not-exist`);
  const body = await res.json();
  check('Bilinmeyen uç NOT_FOUND', body?.errorCode === 'NOT_FOUND', `HTTP ${res.status}`);
}

// ── Rate limiting must not starve sign-in ───────────────────────────────────
// The admin panel calls this API server-side, so its whole traffic arrives from
// one address. Sign-in has a much tighter threshold than the rest of the API,
// and while the two shared a counter that threshold locked the panel out of its
// own login — reported as a 500, because a plugin's plain Error was flattened.
{
  for (let i = 0; i < 12; i++) await fetch(`${API}/website/does-not-exist`);
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.invalid', password: 'x'.repeat(12) }),
  });
  check(
    'Genel trafik sign-in kovasını doldurmuyor',
    res.status === 401,
    `HTTP ${res.status} — 429/500 ise kova paylaşımlı`,
  );
}

// ── Authenticated half ──────────────────────────────────────────────────────
if (!EMAIL || !PASSWORD) {
  console.log('\nKimlik bilgisi verilmedi; oturum gerektiren kontroller atlandı.');
  console.log('VERIFY_ADMIN_EMAIL ve VERIFY_ADMIN_PASSWORD ile çalıştırılabilir.');
} else {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json();
  const token = body?.data?.accessToken;
  check('Login zarflı ve accessToken taşıyor', isEnvelope(body) && typeof token === 'string', `HTTP ${res.status}`);

  if (typeof token === 'string') {
    const auth = { Authorization: `Bearer ${token}` };

    const me = await fetch(`${API}/auth/me`, { headers: auth }).then((r) => r.json());
    check('GET /auth/me zarflı, çift değil', isEnvelope(me) && me.data?.success === undefined);

    const status = await fetch(`${API}/website/publish/status`, { headers: auth }).then((r) => r.json());
    check('GET /website/publish/status zarflı', isEnvelope(status));
    check('  yayın geçmişi kalıcı', Array.isArray(status?.data?.history), `${status?.data?.history?.length ?? 0} kayıt`);
  }
  // Sign-out is deliberately not exercised: it revokes every refresh token for
  // the account, which would end the operator's own panel session.
}

console.log(`\n${total - failures}/${total} kontrol geçti.`);
if (failures > 0) process.exit(1);
console.log('API sözleşmesi doğru.');
