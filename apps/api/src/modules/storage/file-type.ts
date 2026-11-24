/**
 * What a file actually is, read from its bytes.
 *
 * Uploads were accepted on the strength of the MIME type the browser sent,
 * which the sender chooses. A script renamed to logo.png with
 * `Content-Type: image/png` passed. These checks read the file's signature and
 * require it to agree with the declared type.
 *
 * SVG is the special case: it is XML that can carry script. It is accepted only
 * when it contains no script elements, event-handler attributes, javascript:
 * URLs, foreign objects or external entity declarations — and it is served with
 * a sandboxing CSP regardless (storage.controller.ts), so a file that slipped
 * past this check still cannot execute on the API's origin.
 */

export type AllowedMime =
  'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/svg+xml' | 'application/pdf';

export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set<AllowedMime>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
]);

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

/** The type the bytes declare, or null when they match none of the allowed types. */
export function sniffMime(buffer: Buffer): AllowedMime | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (looksLikeSvg(buffer)) return 'image/svg+xml';
  return null;
}

function looksLikeSvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 4096).toString('utf8').replace(/^﻿/, '').trimStart();
  if (!head.startsWith('<')) return false;
  return /<svg[\s>]/i.test(head);
}

/** Constructs in an SVG that can execute script or reach outside the file. */
const UNSAFE_SVG: RegExp[] = [
  /<script[\s>]/i,
  /<foreignObject[\s>]/i,
  /<!ENTITY/i,
  /<!DOCTYPE[^>]*\[/i,
  /\son[a-z]+\s*=/i,
  /(?:href|src)\s*=\s*["']?\s*(?:javascript|data:text\/html|vbscript):/i,
  /<(?:iframe|embed|object)[\s>]/i,
  /<use[^>]+href\s*=\s*["']?\s*https?:/i,
];

export function isSafeSvg(buffer: Buffer): boolean {
  const text = buffer.toString('utf8');
  return !UNSAFE_SVG.some((pattern) => pattern.test(text));
}

export type FileCheck =
  | { ok: true; mime: AllowedMime; reason?: undefined }
  | { ok: false; reason: string };

/**
 * Accepts a file only when its declared type is allowed, its bytes agree, and
 * (for SVG) it carries nothing executable. Messages are Turkish: they reach the
 * panel user as they are.
 */
export function checkUploadedFile(declared: string, buffer: Buffer): FileCheck {
  if (!ALLOWED_MIME_TYPES.has(declared)) {
    return { ok: false, reason: `"${declared}" türündeki dosyalar kabul edilmiyor.` };
  }
  if (buffer.length === 0) return { ok: false, reason: 'Dosya boş.' };

  const actual = sniffMime(buffer);
  if (actual === null) {
    return { ok: false, reason: 'Dosya içeriği desteklenen bir türe ait değil.' };
  }
  if (actual !== declared) {
    return {
      ok: false,
      reason: `Dosya "${declared}" olarak gönderildi ama içeriği "${actual}". Yükleme reddedildi.`,
    };
  }
  if (actual === 'image/svg+xml' && !isSafeSvg(buffer)) {
    return {
      ok: false,
      reason:
        'SVG dosyası betik, olay işleyici veya dış bağlantı içeriyor. Güvenlik nedeniyle reddedildi.',
    };
  }
  return { ok: true, mime: actual };
}
