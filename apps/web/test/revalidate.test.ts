/**
 * The revalidation endpoint's decision logic: who may refresh the site, and what.
 */
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRevalidateRequest,
  resetRevalidateRateLimit,
  type RevalidateInput,
} from '../lib/revalidate';

const SECRET = 'x'.repeat(48);

function input(overrides: Partial<RevalidateInput> = {}): RevalidateInput {
  return {
    secret: SECRET,
    expectedSecret: SECRET,
    contentType: 'application/json',
    body: JSON.stringify({ tags: ['site-content'] }),
    clientKey: 'test',
    now: Date.now(),
    ...overrides,
  };
}

beforeEach(() => resetRevalidateRateLimit());

test('accepts the right secret and a known tag', () => {
  const decision = checkRevalidateRequest(input());
  assert.deepEqual(decision, { ok: true, tags: ['site-content'], paths: [] });
});

test('an empty body revalidates site content', () => {
  const decision = checkRevalidateRequest(input({ body: '', contentType: null }));
  assert.deepEqual(decision, { ok: true, tags: ['site-content'], paths: [] });
});

test('refuses everything when the server has no (or a short) secret', () => {
  assert.deepEqual(checkRevalidateRequest(input({ expectedSecret: undefined })), {
    ok: false,
    status: 503,
  });
  assert.deepEqual(checkRevalidateRequest(input({ expectedSecret: 'short', secret: 'short' })), {
    ok: false,
    status: 503,
  });
});

test('wrong or missing secret is 401', () => {
  assert.deepEqual(checkRevalidateRequest(input({ secret: 'nope' })), { ok: false, status: 401 });
  assert.deepEqual(checkRevalidateRequest(input({ secret: null })), { ok: false, status: 401 });
});

test('oversized body is 413, non-JSON is 415, bad JSON is 400', () => {
  assert.deepEqual(checkRevalidateRequest(input({ body: null })), { ok: false, status: 413 });
  assert.deepEqual(checkRevalidateRequest(input({ contentType: 'text/plain' })), {
    ok: false,
    status: 415,
  });
  assert.deepEqual(checkRevalidateRequest(input({ body: '{not json' })), {
    ok: false,
    status: 400,
  });
});

test('only known tags and site paths', () => {
  assert.deepEqual(checkRevalidateRequest(input({ body: JSON.stringify({ tags: ['users'] }) })), {
    ok: false,
    status: 400,
  });
  assert.deepEqual(
    checkRevalidateRequest(
      input({ body: JSON.stringify({ tags: [], paths: ['https://evil.example/'] }) }),
    ),
    { ok: false, status: 400 },
  );
  assert.deepEqual(
    checkRevalidateRequest(
      input({ body: JSON.stringify({ tags: [], paths: ['/services/seo/'] }) }),
    ),
    { ok: true, tags: [], paths: ['/services/seo/'] },
  );
});

test('rate limited per client', () => {
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    assert.equal(checkRevalidateRequest(input({ now })).ok, true);
  }
  assert.deepEqual(checkRevalidateRequest(input({ now })), { ok: false, status: 429 });
  assert.equal(checkRevalidateRequest(input({ now, clientKey: 'other' })).ok, true);
  assert.equal(checkRevalidateRequest(input({ now: now + 61_000 })).ok, true);
});
