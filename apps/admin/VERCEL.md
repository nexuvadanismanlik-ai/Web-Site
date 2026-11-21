# Running the admin panel on Vercel

Project: `nexuva-admin` (Root Directory `apps/admin`). Production auto-deploy is
off (`vercel.json`); the `feat/admin-vercel` branch builds Preview deployments.

Environment variables (names only; values live in Vercel):

- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` — session signing and the public URL. The
  URL must be `https://…`, because the middleware picks the `__Secure-` cookie
  name from it.
- `NEXT_PUBLIC_API_URL` — API base, including `/api/v1`.
- `NEXT_PUBLIC_SITE_URL` — the public site the visual editor and links point at.

Sign-in, refresh and every data call run on the server, so the API's CORS list
only matters for the two browser health pings (login form, keep-awake), which
fail quietly.
