import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { checkRevalidateRequest, type RevalidateDecision } from '../../../lib/revalidate';

/**
 * Called by the API after a publish to refresh the site's cached pages.
 *
 * The decision logic — secret, size, allowed tags and paths, rate limit — is
 * in lib/revalidate.ts so it can be tested without a server. This file only
 * applies the decision.
 *
 * Responses never say why a request was refused beyond the status code: a
 * caller without the secret learns nothing it can use.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = await readLimitedBody(request);
  const decision: RevalidateDecision = checkRevalidateRequest({
    secret: request.headers.get('x-revalidate-secret'),
    expectedSecret: process.env['REVALIDATE_SECRET'],
    contentType: request.headers.get('content-type'),
    body,
    clientKey: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    now: Date.now(),
  });

  if (!decision.ok) {
    return NextResponse.json({ ok: false }, { status: decision.status });
  }

  for (const tag of decision.tags) revalidateTag(tag);
  for (const path of decision.paths) revalidatePath(path);

  return NextResponse.json({
    ok: true,
    revalidated: { tags: decision.tags, paths: decision.paths },
    at: new Date().toISOString(),
  });
}

/** Any other method is refused, so the endpoint cannot be triggered by a link. */
export function GET(): Response {
  return NextResponse.json({ ok: false }, { status: 405, headers: { Allow: 'POST' } });
}

/**
 * Reads at most MAX_BODY_BYTES; anything longer is reported as oversized
 * without being buffered in full.
 */
async function readLimitedBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return null;
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

const MAX_BODY_BYTES = 4_096;
