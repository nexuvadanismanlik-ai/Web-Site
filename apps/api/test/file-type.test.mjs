/** Uploads are judged by their bytes, not by the type the sender declares. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUploadedFile, sniffMime } from '../dist/apps/api/src/modules/storage/file-type.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PDF = Buffer.from('%PDF-1.7\n');
const SVG = Buffer.from(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
);

test('recognises the allowed formats', () => {
  assert.equal(sniffMime(PNG), 'image/png');
  assert.equal(sniffMime(JPEG), 'image/jpeg');
  assert.equal(sniffMime(PDF), 'application/pdf');
  assert.equal(sniffMime(SVG), 'image/svg+xml');
  assert.equal(sniffMime(Buffer.from('#!/bin/sh\nrm -rf /')), null);
});

test('a declared type must match the content', () => {
  assert.deepEqual(checkUploadedFile('image/png', PNG), { ok: true, mime: 'image/png' });
  assert.equal(checkUploadedFile('image/png', JPEG).ok, false);
  assert.equal(checkUploadedFile('image/png', Buffer.from('<script>alert(1)</script>')).ok, false);
  assert.equal(checkUploadedFile('text/html', Buffer.from('<html>')).ok, false);
  assert.equal(checkUploadedFile('image/png', Buffer.alloc(0)).ok, false);
});

test('SVG with script, handlers or javascript: URLs is refused', () => {
  const bad = [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>x</text></a></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body/></foreignObject></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
  ];
  for (const svg of bad)
    assert.equal(checkUploadedFile('image/svg+xml', Buffer.from(svg)).ok, false, svg);
  assert.equal(checkUploadedFile('image/svg+xml', SVG).ok, true);
});
