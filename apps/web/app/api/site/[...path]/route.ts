import { NextResponse } from 'next/server';

/**
 * Same-origin relay from the browser to the Nexuva API.
 *
 * The site and the API are separate Vercel projects on different origins, and
 * the API only answers browsers from origins on its CORS list. Calling it
 * straight from the page therefore fails with an opaque "Failed to fetch" —
 * which the contact form reported as a generic error and the analytics beacons
 * swallowed silently. Relaying through the site's own origin removes the
 * cross-origin hop altogether, so no browser ever needs a CORS entry, and the
 * API's origin list can stay as strict as it is.
 *
 * Only the paths the browser actually calls are relayed.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const API_BASE = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/+$/, '');

const ALLOWED = [/^website\/contact$/, /^analytics\/(collect|event)$/, /^health$/];
const MAX_BODY = 32 * 1024;
const TIMEOUT_MS = 25_000;

async function relay(request: Request, segments: string[]): Promise<Response> {
  const path = segments.join('/').replace(/\/+$/, '');
  if (!API_BASE || !ALLOWED.some((re) => re.test(path))) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let body: string | undefined;
  if (request.method === 'POST') {
    body = await request.text();
    if (body.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 });
  }

  const headers: Record<string, string> = {
    'content-type': request.headers.get('content-type') ?? 'application/json',
  };
  // The API rate-limits per visitor; without these every request would look
  // like it came from this server.
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    headers['x-forwarded-for'] = forwarded;
    // The platform rewrites x-forwarded-for on the next hop, so the real
    // address also travels under a name of its own.
    headers['x-nexuva-visitor-ip'] = forwarded.split(',')[0]?.trim() ?? '';
  }
  const country = request.headers.get('x-vercel-ip-country');
  if (country) headers['x-nexuva-country'] = country;
  const agent = request.headers.get('user-agent');
  if (agent) headers['user-agent'] = agent;

  try {
    const upstream = await fetch(`${API_BASE}/${path}`, {
      method: request.method,
      headers,
      ...(body !== undefined ? { body } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}

type Ctx = { params: { path: string[] } };

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  return relay(request, params.path);
}

export async function POST(request: Request, { params }: Ctx): Promise<Response> {
  return relay(request, params.path);
}
