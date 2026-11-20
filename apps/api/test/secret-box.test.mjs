/** Mail credentials are sealed at rest; legacy plain values still read. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SecretBox } from '../dist/apps/api/src/modules/email/secret-box.js';

const KEY = 'k'.repeat(40);

test('round-trips and never stores the plain value', () => {
  const box = new SecretBox(KEY);
  const sealed = box.seal('re_live_123');
  assert.ok(sealed.startsWith('enc:v1:'));
  assert.ok(!sealed.includes('re_live_123'));
  assert.equal(box.open(sealed), 're_live_123');
  assert.notEqual(box.seal('same'), box.seal('same'), 'random IV');
});

test('legacy plain text is returned as is', () => {
  assert.equal(new SecretBox(KEY).open('plain-old-key'), 'plain-old-key');
  assert.equal(new SecretBox(KEY).open(null), null);
});

test('a different key cannot open it, and tampering is detected', () => {
  const sealed = new SecretBox(KEY).seal('secret');
  assert.throws(() => new SecretBox('z'.repeat(40)).open(sealed));
  const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA');
  assert.throws(() => new SecretBox(KEY).open(tampered));
});

test('without a key nothing is sealed', () => {
  const box = new SecretBox(undefined);
  assert.equal(box.configured, false);
  assert.throws(() => box.seal('x'));
  assert.equal(new SecretBox('short').configured, false);
});
