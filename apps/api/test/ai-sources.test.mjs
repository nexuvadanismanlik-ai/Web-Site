/** AI-referred visits are recognisable as their own channel. */
import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aiSourceFromUtm,
  classifySource,
} from '../dist/apps/api/src/modules/analytics/analytics.service.js';
import { buildIndexNowPayload } from '../dist/apps/api/src/modules/website/publish/indexnow.service.js';

test('referrers from AI assistants are classified', () => {
  assert.equal(classifySource('https://chatgpt.com/'), 'ai:chatgpt');
  assert.equal(classifySource('https://www.perplexity.ai/search?q=x'), 'ai:perplexity');
  assert.equal(classifySource('https://claude.ai/chat/abc'), 'ai:claude');
  assert.equal(classifySource('https://gemini.google.com/app'), 'ai:gemini');
  assert.equal(classifySource('https://copilot.microsoft.com/'), 'ai:copilot');
  assert.equal(classifySource('https://www.google.com/'), 'google', 'search engines unchanged');
  assert.equal(classifySource(undefined), 'direct');
});

test('utm_source values set by assistants map to the same names', () => {
  assert.equal(aiSourceFromUtm('chatgpt.com'), 'ai:chatgpt');
  assert.equal(aiSourceFromUtm('perplexity'), 'ai:perplexity');
  assert.equal(aiSourceFromUtm('newsletter'), null);
});

test('IndexNow payload uses the site host and key location', () => {
  const body = buildIndexNowPayload(new URL('https://nexuva.example'), 'abcd1234', [
    '/',
    '/services/',
  ]);
  assert.deepEqual(body, {
    host: 'nexuva.example',
    key: 'abcd1234',
    keyLocation: 'https://nexuva.example/indexnow-key.txt',
    urlList: ['https://nexuva.example/', 'https://nexuva.example/services/'],
  });
});
