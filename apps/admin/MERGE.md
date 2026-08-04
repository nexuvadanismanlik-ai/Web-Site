# Merging the admin panel into the public site

## Why the panel is a separate deployment today

`apps/web` is built with `output: 'export'` — a folder of plain HTML/CSS/JS with
no Node process at runtime. That setting applies to the **whole application**;
there is no per-route version of it.

The admin genuinely needs a server. Five things it uses cannot exist in a folder
of static files:

| Feature | Where |
| --- | --- |
| Server Actions | `app/actions.ts` |
| Route handler | `app/api/auth/[...nextauth]/route.ts` |
| `getServerSession` in server components | `app/(dashboard)/layout.tsx`, `app/actions.ts`, `lib/api.ts` |
| `export const dynamic = 'force-dynamic'` | 14 dashboard pages |
| `middleware.ts` | Auth guard |

So this is a build-output constraint, not a preference about service
granularity. **It expires the moment `apps/web` stops being a static export** —
which is already planned for unrelated reasons (see `apps/web/MIGRATION.md`,
where the site moves to a Render Web Service with ISR so content can publish
without a redeploy).

**Do the ISR migration first. This merge depends on it and is meaningless
without it.**

## Target

One Next.js Web Service serving `nexuva.com`:

```
apps/web/app/
  [locale]/…              → the marketing site (tr, en)
  web/admin/…             → the panel
```

Two Render services in total (web + api), down from three.

Not a proxy, not a rewrite rule, not Next's `basePath` — a literal route subtree
on the same origin, so the panel and the site share cookies, session and origin.
That last point also simplifies the visual editor, whose iframe currently talks
across origins.

## What is already prepared

The panel was written to survive this move:

- **`lib/routes.ts`** — every href, redirect, auth callback and `revalidatePath`
  goes through `adminPath()`. Setting `NEXT_PUBLIC_ADMIN_BASE_PATH=/web/admin`
  re-points all of them at once. Verified in both modes.
- **`components/root-shell.tsx`** — the `<html>`/`<body>` wrapper, font
  variables and global stylesheet live in exactly one component, because a
  merged app may only have one root layout.
- **`middleware.ts`** — already skips requests outside `ADMIN_BASE_PATH`, so it
  will not intercept marketing traffic.
- **`lib/api.ts`** — talks to the API over HTTP with a bearer token. Nothing
  about it assumes a particular host.

## Procedure

### 1. Move the files

```
apps/admin/app/(auth)/…        → apps/web/app/web/admin/(auth)/…
apps/admin/app/(dashboard)/…   → apps/web/app/web/admin/(dashboard)/…
apps/admin/app/api/auth/…      → apps/web/app/api/admin-auth/…   (see step 4)
apps/admin/components/…        → apps/web/components/admin/…
apps/admin/lib/…               → apps/web/lib/admin/…
```

Fix the relative import depths as you go — that is the bulk of the work and it
is mechanical.

### 2. Drop the root shell

In the two moved layouts, replace `<RootShell>…</RootShell>` with a fragment and
delete `root-shell.tsx`. The host app owns `<html>`, `<body>`, fonts and global
CSS. Merge any admin-only styles into the host stylesheet, scoped under a class
so they cannot leak into marketing pages.

### 3. Set the base path

`NEXT_PUBLIC_ADMIN_BASE_PATH=/web/admin` on the web service.

> **Do not also set Next's `basePath`.** Next prefixes every href itself when
> `basePath` is set; combined with `adminPath()` you get
> `/web/admin/web/admin/hero` and the panel 404s on itself.

### 4. Auth

NextAuth's route handler must stay under `/api/…` — it cannot move to
`/web/admin/api/…` without extra configuration. Keep it at
`app/api/admin-auth/[...nextauth]/route.ts` and point the client at it:

```ts
// in authOptions
pages: { signIn: adminPath('/login') },
// and on the client
signIn('credentials', { …, callbackUrl: adminPath('/') })
```

Set `NEXTAUTH_URL` to the site origin (`https://nexuva.com`), not the admin
subpath. Confirm the session cookie path is `/` so it survives navigation
between the marketing site and the panel.

### 5. Middleware — the highest-risk step

`apps/web` regains a `middleware.ts` during the ISR migration, to detect the
browser language and redirect `/` to `/tr`. In the merged app the admin guard
and the locale redirect live in the same middleware, and **order matters**:

```ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin first — otherwise the locale branch rewrites /web/admin to /tr/web/admin.
  if (pathname.startsWith('/web/admin')) return adminGuard(request);

  return localeRedirect(request);
}
```

Get this backwards and the panel becomes unreachable in a way that looks like a
routing bug rather than an ordering bug.

### 6. Retire the admin service

Delete the Render service and remove `apps/admin` from the workspace, or keep
the directory as a thin re-export while the merge settles.

## The `[locale]` collision

`/web/admin` is two segments and `[locale]` matches one, and Next prefers
literal segments over dynamic ones — so the panel route itself is safe.

The danger is bare **`/web`**: one segment, so it matches `[locale]` with
`locale = "web"`, and `normalizeLocale()` in `apps/web/lib/i18n.ts` returns
`'tr'` for anything it does not recognise instead of rejecting. Under ISR that
would answer `/web`, `/pricing` and every typo with HTTP 200 and the Turkish
homepage — unbounded duplicate content for crawlers, on a site whose value is
organic search.

`export const dynamicParams = false` in `apps/web/app/[locale]/layout.tsx`
closes this. **It is already committed** — it costs nothing under static export
and would be easy to forget at migration time. Consider also calling
`notFound()` for unknown locales, since the silent fallback is what made the
hole invisible.

## What the merge costs

Worth stating plainly, because it is the real argument against doing it:

- **Shared blast radius.** One bad admin build takes the marketing site down
  with it; a type error in an editor component blocks a copy fix from shipping.
- **Shared deploy cadence.** No more deploying the panel without redeploying
  the site.
- **Larger public attack surface.** Auth routes and server actions sit on the
  same origin as public pages.

Acceptable for one repository with one maintainer. If isolation ever outweighs
URL shape, keeping the panel on its own host is a perfectly defensible permanent
answer — it costs the same and is what Render is built around.

## Checklist

- [ ] `apps/web` migrated to a Web Service with ISR (`apps/web/MIGRATION.md`)
- [ ] Files moved, imports fixed
- [ ] `RootShell` removed, admin styles scoped
- [ ] `NEXT_PUBLIC_ADMIN_BASE_PATH=/web/admin` set; Next `basePath` **not** set
- [ ] NextAuth handler under `/api/…`, `NEXTAUTH_URL` = site origin, cookie path `/`
- [ ] Middleware checks `/web/admin` **before** the locale branch
- [ ] `dynamicParams = false` still present
- [ ] Verified: sign in, edit content, Publish, and confirm the marketing site is
      untouched by an admin deploy
- [ ] Old admin Render service deleted
