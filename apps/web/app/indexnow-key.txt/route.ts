/**
 * The IndexNow ownership key.
 *
 * IndexNow engines fetch this file before accepting a change notification for
 * the host. The API sends the same key (INDEXNOW_KEY) with `keyLocation`
 * pointing here. Without the variable the route answers 404, and the API
 * sends nothing either.
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const key = process.env['INDEXNOW_KEY']?.trim();
  if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    return new Response('Not found', { status: 404 });
  }
  return new Response(key, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
