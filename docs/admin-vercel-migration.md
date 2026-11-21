# Süper Admin paneli (apps/admin) — Vercel'e taşıma planı

Durum: **hazırlık**. Vercel projesi henüz oluşturulmadı, `main`'e dokunulmadı.

## İnceleme sonucu

- `apps/admin` Next.js 14 (App Router), NextAuth (Credentials). Giriş, API'ye (`NEXT_PUBLIC_API_URL`) bearer token ile gider; admin veritabanına doğrudan bağlanmaz.
- Yerel build, typecheck ve lint geçiyor (0 hata, 2 uyarı).
- `apps/admin/vercel.json` zaten var: framework nextjs, fra1, monorepo install/build komutları. Otomatik deploy `main` ve `vercel-migration` için kapalı.
- Kod değişikliği gerekmedi: panel host'tan bağımsız yazılmış (`lib/routes.ts`, `lib/api.ts`).
- `components/keep-awake.tsx` Render'ın uyku davranışı içindi. Vercel'de zararsız (10 dakikada bir sağlık kontrolü); kaldırmak isteğe bağlı.

## Vercel proje ayarları (önerilen)

| Ayar | Değer |
| --- | --- |
| Proje adı | `nexuva-admin` (mevcut projeler: `nexuva`, `web-site-api`; çakışma yok) |
| Repo | nexuvadanismanlik-ai/Web-Site |
| Root Directory | `apps/admin` |
| Framework | Next.js |
| Install / Build | `apps/admin/vercel.json` içinden gelir |
| Production branch | `main` (otomatik deploy kapalı kalır; onayla elle) |
| Node | `web-site-api` ile aynı `NODE_VERSION` |

## Admin proje ortam değişkenleri (yalnızca isimler)

| İsim | Not |
| --- | --- |
| `NEXTAUTH_SECRET` | Zorunlu. Yeni üretilebilir (oturumlar sıfırlanır). Render'daki mevcut değer okunamadı. |
| `NEXTAUTH_URL` | Admin'in gerçek Vercel adresi (proje oluşunca belli olur) |
| `NEXT_PUBLIC_API_URL` | `https://web-site-api-eta.vercel.app/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | `https://nexuvatr.vercel.app` |
| `NODE_VERSION` | API ile aynı |

## Diğer projelerde gereken değişiklikler (ONAY GEREKİR)

`web-site-api` mevcut ortam değişkenleri: APP_ENV, DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, NODE_ENV, NODE_VERSION, PUBLISH_STRATEGY, WEBSITE_TENANT_SLUG. Eksik olanlar:

- `CORS_ORIGINS`: yoksa varsayılan yalnızca localhost; tarayıcıdan giriş yapılamaz. Admin'in yeni adresi eklenmeli.
- `FRONTEND_REVALIDATE_URL` ve `FRONTEND_REVALIDATE_SECRET`: yayınlama `revalidate` stratejisindeyse gerekli (web tarafı: `/api/revalidate`).
- `PUBLISH_STRATEGY` değeri gizli; okunamadı. `deploy-hook` ise eski `RENDER_DEPLOY_HOOK_URL` bağımlılığı kaldırılıp `revalidate` stratejisine geçilmeli.

`nexuva` (web) projesinde eksik: `REVALIDATE_SECRET` (API'deki `FRONTEND_REVALIDATE_SECRET` ile aynı olmalı).

## Doğrulama listesi (Preview'da)

Giriş sayfası, Süper Admin girişi, oturum kalıcılığı/yenileme, içerik düzenleme-kaydetme, medya yükleme, yayınlama → web sitesinin güncellenmesi, rol kontrolleri. Henüz hiçbiri çalıştırılmadı.

## Dokunulmayanlar

LogiOps, nexuva-core, Supabase `core` şeması, mevcut kullanıcı ve şifreler, DNS, Render hizmeti.
