# Ortam Değişkenleri

Değerler bu belgeye **yazılmaz**. "Gizli" olanlar Vercel'de _Sensitive_ olarak eklenir.

## nexuva-api

| Değişken                                                                     | Zorunlu                            | Gizli             | Açıklama                                                                                                                           |
| ---------------------------------------------------------------------------- | ---------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                               | Evet                               | Evet              | Supabase pooler, 6543, `?pgbouncer=true&connection_limit=1`                                                                        |
| `DIRECT_URL`                                                                 | Migration adımında                 | Evet              | 5432 doğrudan bağlantı; çalışırken gerekmez                                                                                        |
| `APP_ENV`                                                                    | Evet                               |                   | `production` / `development` / `staging`                                                                                           |
| `NODE_ENV`                                                                   | Evet                               |                   | `production`                                                                                                                       |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                    | Evet                               | Evet              | ≥32 karakter. Render'dakilerle aynı olursa açık oturumlar korunur                                                                  |
| `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`                                    | Hayır                              |                   | `15m`, `7d`                                                                                                                        |
| `CORS_ORIGINS`                                                               | Evet                               |                   | Virgülle: site ve admin adresleri (preview için ayrı)                                                                              |
| `TRUST_PROXY`                                                                | Hayır                              |                   | `NODE_ENV=production` iken varsayılan 1 (Vercel'in tek proxy katmanı için doğru); rate limit gerçek istemci IP'sini görür          |
| `API_PUBLIC_URL`                                                             | Önerilir                           |                   | Veritabanında saklanan dosyaların mutlak adresi. Yoksa Vercel production alan adı kullanılır                                       |
| `SITE_URL`                                                                   | Evet                               |                   | Yayın doğrulaması ve IndexNow için sitenin adresi                                                                                  |
| `PUBLISH_STRATEGY`                                                           | Evet                               |                   | `revalidate`                                                                                                                       |
| `FRONTEND_REVALIDATE_URL`                                                    | Evet                               |                   | `https://<site>/api/revalidate`                                                                                                    |
| `FRONTEND_REVALIDATE_SECRET`                                                 | Evet                               | Evet              | ≥32 karakter; sitedeki `REVALIDATE_SECRET` ile aynı                                                                                |
| `PUBLISH_VERIFY_ATTEMPTS`, `PUBLISH_VERIFY_DELAY_MS`                         | Hayır                              |                   | Varsayılan 6 ve 2000                                                                                                               |
| `INDEXNOW_KEY`                                                               | Hayır                              |                   | 8–128 karakter harf/rakam/tire; sitedeki ile aynı                                                                                  |
| `WEBSITE_TENANT_SLUG`                                                        | Hayır                              |                   | `nexuva`                                                                                                                           |
| `EMAIL_PROVIDER`                                                             | Hayır                              |                   | `resend`                                                                                                                           |
| `EMAIL_FROM`, `EMAIL_FROM_NAME`                                              | Evet (bildirim için)               |                   | Resend'de doğrulanmış alan adından                                                                                                 |
| `RESEND_API_KEY`                                                             | Evet (bildirim için)               | Evet              | Resend hesabından                                                                                                                  |
| `CONTACT_NOTIFY_EMAIL`                                                       | Önerilir                           |                   | Yeni talep bildiriminin gideceği adresler                                                                                          |
| `MAIL_ENCRYPTION_KEY`                                                        | Panelden mail anahtarı girilecekse | Evet              | ≥32 karakter; panelde saklanan API anahtarı/SMTP şifresini şifreler. Değiştirilirse saklananlar okunamaz, panelden yeniden girilir |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` | R2 kullanılacaksa                  | Evet (anahtarlar) | Yoksa dosyalar veritabanında (4 MB sınırı)                                                                                         |
| `R2_BUCKET_NAME`                                                             | Hayır                              |                   | `nexuva-os`                                                                                                                        |

## nexuva (site)

| Değişken                   | Zorunlu            | Gizli | Açıklama                                                                                     |
| -------------------------- | ------------------ | ----- | -------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`      | Evet               |       | Production: production API; Preview: preview API                                             |
| `NEXT_PUBLIC_SITE_URL`     | Production'da evet |       | Kalıcı adres. Preview'da ayarlanmaz (canonical production'ı gösterir, preview zaten noindex) |
| `REVALIDATE_SECRET`        | Evet               | Evet  | API'deki `FRONTEND_REVALIDATE_SECRET` ile aynı                                               |
| `NEXT_PUBLIC_ADMIN_ORIGIN` | Önerilir           |       | Görsel düzenleyicinin mesaj göndereceği tek adres                                            |
| `INDEXNOW_KEY`             | Hayır              |       | API'deki ile aynı                                                                            |
| `NEXUVA_CONTENT_FIXTURE`   | Sadece CI          |       | Production deploy'unda reddedilir                                                            |

## nexuva-admin

| Değişken              | Zorunlu | Gizli | Açıklama                                 |
| --------------------- | ------- | ----- | ---------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Evet    |       | API adresi (`/api/v1` dahil)             |
| `NEXTAUTH_URL`        | Evet    |       | Panelin kendi adresi (https)             |
| `NEXTAUTH_SECRET`     | Evet    | Evet  | ≥32 karakter (`openssl rand -base64 32`) |

## Kaldırılacaklar (Render kapatıldıktan sonra)

`RENDER_DEPLOY_HOOK_URL`, `RENDER_API_KEY`, `RENDER_FRONTEND_SERVICE_ID`, `NODE_VERSION`.
`RENDER_DEPLOY_HOOK_URL` kod tarafından geçiş süresince yedek olarak okunur; yerine `DEPLOY_HOOK_URL` gelir.
