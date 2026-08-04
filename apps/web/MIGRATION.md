# Migrating the website from static export to ISR

## Why this document exists

The site currently ships as a **static export** on a Render **Static Site**.
That was a deliberate, temporary choice to get to production quickly. A static
host has no runtime, so published HTML can only change when the site is rebuilt
— which is why editing content triggers a Render deploy hook today.

The target is a Render **Web Service** running Next.js normally, where editing
content invalidates a cache tag and the next request re-renders. Content updates
land in seconds, deploy hooks go back to being only for code, and SEO is
unaffected because pages are still fully rendered HTML.

The code is already arranged for that switch. This is the whole list.

## What does NOT change

Worth stating, because it is most of the system:

- Every component, page, layout and style
- `@nexuva/ui`, `@nexuva/shared`, `@nexuva/types`
- The API, its database schema, and every endpoint
- The admin panel, including the visual click-to-edit overlay
- The Publish button — it keeps working, it just gets fast

## The five changes

### 1. `next.config.mjs` — stop exporting

```diff
 const config = {
-  output: 'export',
   trailingSlash: true,
   transpilePackages: ['@nexuva/ui', '@nexuva/shared', '@nexuva/types'],
   images: {
-    unoptimized: true,
     remotePatterns: [ /* unchanged */ ],
   },
 };
```

Dropping `unoptimized` is optional but recommended: image optimization needs a
runtime, and now there is one.

### 2. `lib/content.ts` — one field

```diff
     res = await fetch(url, {
-      cache: 'force-cache',
       next: { revalidate: REVALIDATE_SECONDS, tags: [SITE_CONTENT_TAG] },
     });
```

`force-cache` exists only because a static export cannot prerender a fetch
marked dynamic. The `next: { revalidate, tags }` options are already present and
inert under export; removing `cache` is what activates them.

Also delete the module-level `cached` promise in that file. It memoises per
build, which is right for a one-shot build and wrong for a long-lived server —
Next's own fetch cache takes over that job.

### 3. Add the revalidation endpoint

New file `app/api/revalidate/route.ts` — it cannot exist today because route
handlers are not allowed under `output: 'export'`.

```ts
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { SITE_CONTENT_TAG } from '../../../lib/content';

export async function POST(request: Request) {
  const secret = request.headers.get('x-revalidate-secret');
  if (!secret || secret !== process.env['REVALIDATE_SECRET']) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { tags?: string[] };
  const tags = body.tags?.length ? body.tags : [SITE_CONTENT_TAG];
  for (const tag of tags) revalidateTag(tag);

  return NextResponse.json({ ok: true, revalidated: tags });
}
```

Set `REVALIDATE_SECRET` on the web service to the same value as the API's
`FRONTEND_REVALIDATE_SECRET`. Compare with a constant-time comparison if the
secret ever becomes long-lived and high-value.

### 4. Restore locale routing to middleware

`public/index.html` is a static-export workaround: it detects the browser
language in the browser and redirects `/` to `/tr/` or `/en/`. With a runtime,
middleware does this properly — server-side, before any HTML is sent, which is
better for crawlers.

Delete `public/index.html` and restore `middleware.ts` (it is in the history at
commit `4a570db`, removed as part of the static-export work).

### 5. Switch the publish strategy — configuration only, no code

On the API service:

```
PUBLISH_STRATEGY=revalidate
FRONTEND_REVALIDATE_URL=https://<web-service>.onrender.com/api/revalidate
FRONTEND_REVALIDATE_SECRET=<same value as the site's REVALIDATE_SECRET>
```

`RENDER_DEPLOY_HOOK_URL` can then be removed. `PublishService` already
implements both strategies; nothing in the API changes.

On Render: replace the Static Site with a Web Service.

```
Build Command: pnpm install && pnpm --filter @nexuva/shared run build && pnpm --filter @nexuva/web run build
Start Command: pnpm --filter @nexuva/web run start
```

Note `apps/web/package.json` currently has no `start` script — it was replaced
with `preview` when the app became a static export. Restore
`"start": "next start"`.

## Operational notes for the ISR setup

- **Instance count.** Next's ISR cache lives on each instance's filesystem. A
  revalidation call reaches one instance, so with more than one the others keep
  serving stale HTML until `REVALIDATE_SECONDS` elapses. Stay on a single
  instance, or move the cache to a shared store, before scaling out.
- **Ephemeral disk.** Render restarts wipe the cache. The only effect is that
  the first request after a restart re-renders.
- **`REVALIDATE_SECONDS` is the safety net.** Even if a revalidation call is
  lost, the site self-heals within that window. Do not set it to `false`.
- **Cold starts.** Render free-tier web services spin down when idle and take
  tens of seconds to wake. For a public marketing site that is a real SEO and
  UX cost — this migration effectively assumes a paid instance.

## Checklist

- [ ] `output: 'export'` and `images.unoptimized` removed
- [ ] `cache: 'force-cache'` removed and the `cached` promise deleted
- [ ] `app/api/revalidate/route.ts` added, `REVALIDATE_SECRET` set
- [ ] `public/index.html` deleted, `middleware.ts` restored
- [ ] `"start": "next start"` restored in `package.json`
- [ ] Render Static Site replaced by a Web Service
- [ ] API switched to `PUBLISH_STRATEGY=revalidate`
- [ ] Verified: edit content in the admin, press Publish, see the change without
      a deploy — and confirm the change is in the served HTML (`curl`, not just
      the browser) so SEO parity is proven
