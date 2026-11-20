/**
 * A publish only counts once the live site serves the new content version.
 * Run against the build: pnpm --filter @nexuva/api build && pnpm --filter @nexuva/api test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeOutcome,
  extractContentVersion,
  verifySiteVersion,
} from '../dist/apps/api/src/modules/website/publish/publish-verification.js';

const page = (v) =>
  `<html><head><meta name="nexuva-content-version" content="${v}"/></head></html>`;
const respond =
  (status, body = '') =>
  async () =>
    new Response(body, { status });
const noSleep = async () => {};

test('reads the version Next renders, in either attribute order', () => {
  assert.equal(extractContentVersion(page(23)), 23);
  assert.equal(extractContentVersion('<meta content="7" name="nexuva-content-version">'), 7);
  assert.equal(extractContentVersion('<html></html>'), null);
});

test('verified when the site serves the version (or a later one)', async () => {
  const exact = await verifySiteVersion('https://s', 23, {
    attempts: 1,
    delayMs: 0,
    timeoutMs: 1000,
    fetchImpl: respond(200, page(23)),
  });
  assert.deepEqual(exact, { status: 'verified', served: 23, attempts: 1 });
  const later = await verifySiteVersion('https://s', 23, {
    attempts: 1,
    delayMs: 0,
    timeoutMs: 1000,
    fetchImpl: respond(200, page(24)),
  });
  assert.equal(later.status, 'verified');
});

test('retries until the new version appears', async () => {
  let calls = 0;
  const fetchImpl = async () => new Response(page(++calls >= 3 ? 24 : 23), { status: 200 });
  const outcome = await verifySiteVersion('https://s', 24, {
    attempts: 5,
    delayMs: 0,
    timeoutMs: 1000,
    fetchImpl,
    sleep: noSleep,
  });
  assert.deepEqual(outcome, { status: 'verified', served: 24, attempts: 3 });
});

test('stale when the site keeps serving the old version — a 200 is not success', async () => {
  const outcome = await verifySiteVersion('https://s', 24, {
    attempts: 3,
    delayMs: 0,
    timeoutMs: 1000,
    fetchImpl: respond(200, page(23)),
    sleep: noSleep,
  });
  assert.equal(outcome.status, 'stale');
  assert.match(describeOutcome(outcome, 24), /ulaşmadı/);
});

test('unreachable when the site never answers', async () => {
  const fetchImpl = async () => {
    throw new Error('ECONNREFUSED');
  };
  const outcome = await verifySiteVersion('https://s', 1, {
    attempts: 2,
    delayMs: 0,
    timeoutMs: 1000,
    fetchImpl,
    sleep: noSleep,
  });
  assert.equal(outcome.status, 'unreachable');
  const http500 = await verifySiteVersion('https://s', 1, {
    attempts: 2,
    delayMs: 0,
    timeoutMs: 1000,
    fetchImpl: respond(500),
    sleep: noSleep,
  });
  assert.equal(http500.status, 'unreachable');
});
