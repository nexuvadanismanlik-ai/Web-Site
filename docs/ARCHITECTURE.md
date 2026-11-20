# Nexuva Web Platformu — Mimari

> Durum: `vercel-migration` dalı. Production hâlâ Render (API, admin) + Vercel (site) karma yapısındadır; bu belge hedef ve dalda hazırlanan mimariyi anlatır. Geçiş adımları: [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md), [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

## Bileşenler

| Bileşen        | Kaynak       | Vercel projesi        | Çalışma biçimi                                                     | Bölge        |
| -------------- | ------------ | --------------------- | ------------------------------------------------------------------ | ------------ |
| Kurumsal site  | `apps/web`   | `nexuva` (mevcut)     | Next.js 14, ISR + on-demand revalidation                           | `fra1`       |
| API            | `apps/api`   | `nexuva-api` (yeni)   | NestJS 10 + Fastify, tek Vercel Function (Fluid compute)           | `fra1`       |
| Yönetim paneli | `apps/admin` | `nexuva-admin` (yeni) | Next.js 14, NextAuth, Server Actions, middleware                   | `fra1`       |
| Veritabanı     | —            | —                     | Supabase `nexuva-os`, yalnızca `public` şeması                     | eu-central-1 |
| Dosyalar       | —            | —                     | Cloudflare R2 (yapılandırılırsa) veya veritabanı (`storage_blobs`) | —            |
| E-posta        | —            | —                     | Resend (API anahtarı ile)                                          | —            |

`core` şeması `nexuva-core` uygulamasına aittir; bu proje ona dokunmaz. LogiOps ayrı bir üründür; site yalnızca LogiOps'u anlatan sayfaları ve LogiOps uygulamasına giden bağlantıları içerir.

## Veri akışı

```
Ziyaretçi ──► nexuva (site, ISR önbellek) ──fetch, tag:site-content──► nexuva-api ──Prisma──► Supabase (public)
                 ▲                                                         ▲
                 │ POST /api/revalidate (gizli anahtar)                     │ Bearer JWT
                 └──────────────── nexuva-api ◄── Yayınla ── nexuva-admin ──┘
```

### Yayınlama

1. Panelde **Yayınla** → `POST /api/v1/website/publish`.
2. API taslağı yeni bir içerik sürümü olarak dondurur (`content_versions`).
3. API, sitenin `/api/revalidate` uç noktasına `x-revalidate-secret` ile POST atar.
4. Site `site-content` etiketini geçersiz kılar.
5. API, `SITE_URL` adresindeki ana sayfayı okur ve `<meta name="nexuva-content-version">` değerinin yeni sürüm (veya daha yenisi) olduğunu doğrular (6 deneme × 2 sn, ayarlanabilir).
6. Sonuç `publish_logs`'a yazılır: doğrulandıysa `SUCCEEDED`, aksi halde gerekçesiyle `FAILED`. Sadece HTTP 200 başarı sayılmaz.
7. Doğrulanmış yayından sonra (anahtar tanımlıysa) IndexNow'a değişen sayfalar bildirilir.

### Kimlik doğrulama

- API: global `JwtAuthGuard` + `RolesGuard`; varsayılan kapalı, yalnızca `@Public()` uç noktalar açık (site içeriği, iletişim formu, analytics, dosya sunma, health vb.).
- Panel: NextAuth (JWT oturum, 8 saat hareketsizlikte biter), API token'ları şifreli oturum çerezi içinde; middleware her istekte rolü doğrular.

## Site adresi tek kaynaktan

`apps/web/lib/origin.ts`: `NEXT_PUBLIC_SITE_URL` → yoksa Vercel'in `VERCEL_PROJECT_PRODUCTION_URL` değeri. Panelin SEO ekranındaki canonical alanı artık **okunmaz** (eski Render adresini taşıyordu). Kalıcı alan adı bağlandığında yalnızca `NEXT_PUBLIC_SITE_URL` değişir.

## Önemli dosyalar

| Konu                          | Dosya                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| İçerik yükleme, ISR           | `apps/web/lib/content.ts`                                                                |
| Revalidation                  | `apps/web/app/api/revalidate/route.ts`, `apps/web/lib/revalidate.ts`                     |
| SEO yardımcıları              | `apps/web/lib/seo.ts`, `lib/origin.ts`, `lib/verified-facts.ts`, `lib/brand-identity.ts` |
| Hizmet sayfaları              | `apps/web/app/services/[slug]/page.tsx`, `lib/services.ts`, `lib/service-details.ts`     |
| Yayın + doğrulama             | `apps/api/src/modules/website/publish/*`                                                 |
| Hazırlık kontrolleri          | `apps/api/src/modules/health/readiness.service.ts`                                       |
| Dosya güvenliği               | `apps/api/src/modules/storage/file-type.ts`                                              |
| Mail kimlik bilgisi şifreleme | `apps/api/src/modules/email/secret-box.ts`                                               |
| Vercel ayarları               | `apps/{web,api,admin}/vercel.json`                                                       |
