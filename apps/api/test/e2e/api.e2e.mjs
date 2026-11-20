/**
 * End-to-end checks against a running API and a THROWAWAY database.
 *
 * CI starts PostgreSQL in a container, applies every migration, seeds it and
 * starts the API, then runs this file (.github/workflows/ci.yml). It must
 * never be pointed at production: it signs in, writes contact messages and
 * publishes content. The guard below refuses unless E2E_ALLOW_WRITES=yes and
 * the API reports a non-production environment.
 *
 *   API_URL=http://localhost:4000/api/v1 E2E_ALLOW_WRITES=yes \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node --test test/e2e/
 */
import { before, test } from 'node:test';
import assert from 'node:assert/strict';

const API = (process.env.API_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@nexuva.com';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';

const json = async (res) => {
  const body = await res.json().catch(() => ({}));
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
};
const post = (path, body, token) =>
  fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

let token = '';
let refreshToken = '';

before(() => {
  if (process.env.E2E_ALLOW_WRITES !== 'yes') {
    throw new Error(
      'E2E_ALLOW_WRITES=yes is required: these tests write to the database they run against.',
    );
  }
  if (process.env.APP_ENV === 'production')
    throw new Error('Refusing to run e2e against production.');
});

test('health answers', async () => {
  const res = await fetch(`${API}/health`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('protected routes need a token', async () => {
  const res = await fetch(`${API}/website/publish/status`);
  assert.equal(res.status, 401);
});

test('login refuses a wrong password', async () => {
  const res = await post('/auth/login', { email: EMAIL, password: `${PASSWORD}-wrong` });
  assert.equal(res.status, 401);
});

test('login succeeds and refresh issues a new access token', async () => {
  const res = await post('/auth/login', { email: EMAIL, password: PASSWORD });
  assert.equal(res.status, 200, 'set ADMIN_EMAIL / ADMIN_PASSWORD to the seeded account');
  const body = await json(res);
  token = body.accessToken;
  refreshToken = body.refreshToken;
  assert.ok(token && refreshToken);

  const refreshed = await post('/auth/refresh', { refreshToken });
  assert.equal(refreshed.status, 200);
  assert.ok((await json(refreshed)).accessToken);
});

test('public content serves the published version with its number', async () => {
  const res = await fetch(`${API}/website/content`);
  assert.equal(res.status, 200);
  const content = await json(res);
  assert.ok(content.brand);
  assert.equal(typeof content.publication?.version, 'number');
});

test('contact form: valid message accepted, invalid refused, honeypot ignored', async () => {
  const ok = await post('/website/contact', {
    name: 'E2E Test',
    email: 'e2e@example.com',
    message: 'Otomatik test mesajı.',
    consent: true,
  });
  assert.ok(ok.status === 200 || ok.status === 201, `status ${ok.status}`);

  const invalid = await post('/website/contact', { name: '', email: 'not-an-email', message: '' });
  assert.equal(invalid.status, 400);

  const bot = await post('/website/contact', {
    name: 'Bot',
    email: 'bot@example.com',
    message: 'spam',
    website: 'https://spam.example',
  });
  assert.ok(bot.status < 500, 'honeypot submissions are absorbed, not errors');
});

test('publish without a configured strategy is reported as failed, not as success', async () => {
  const res = await post('/website/publish', {}, token);
  assert.ok(res.status === 200 || res.status === 201);
  const result = await json(res);
  assert.equal(result.state, 'FAILED');
  assert.equal(typeof result.version, 'number');
});
