# Güvenlik

## Bu dalda uygulananlar

| Konu                   | Değişiklik                                                                                                                        | Dosya                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| JSON-LD XSS            | `<`, `>`, `&`, U+2028/9 kaçışı; tüm şema blokları `serializeJsonLd` kullanır                                                      | `apps/web/lib/seo.ts`                       |
| Dosya yükleme          | Tür, dosyanın baytlarından tespit edilir ve beyan edilen türle eşleşmeli; boş dosya reddedilir                                    | `apps/api/src/modules/storage/file-type.ts` |
| SVG                    | Betik, olay işleyici, `javascript:`, `foreignObject`, entity bildirimi, dış `use` içeren SVG reddedilir                           | aynı                                        |
| Dosya sunma            | `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`                                         | `storage.controller.ts`                     |
| Dosya anahtarı         | Dosya adı anahtara güvenli karakterlerle girer                                                                                    | `storage.service.ts`                        |
| Büyük dosya            | 4 MB üstü için presigned R2 yükleme; tamamlanınca içerik yeniden doğrulanır, uymazsa silinir                                      | `storage.service.ts`                        |
| API başlıkları         | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP, production'da HSTS                                      | `apps/api/src/main.ts`                      |
| Site başlıkları        | `nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP **Report-Only**                                                           | `apps/web/next.config.mjs`                  |
| Panel başlıkları       | `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`                                                        | `apps/admin/next.config.mjs`                |
| Panel oturumu          | 8 saat hareketsizlikte biter (önce 30 gün)                                                                                        | `apps/admin/lib/auth.ts`                    |
| postMessage            | Site yalnızca panelin origin'ine mesaj gönderir; panel yalnızca sitenin origin'inden gelen mesajı kabul eder                      | `edit-overlay.tsx`, `visual-editor.tsx`     |
| Entegrasyon kimlikleri | GA4/GTM/Pixel/Ads/Clarity kimlikleri formata uymazsa script'e yazılmaz                                                            | `apps/web/components/integrations.tsx`      |
| Revalidation           | Sabit zamanlı gizli anahtar karşılaştırması, sadece POST, 4 KB gövde sınırı, izinli tag/path, rate limit, yapılandırılmamışsa 503 | `apps/web/lib/revalidate.ts`                |
| Mail kimlik bilgileri  | AES-256-GCM ile şifreli saklanır (`MAIL_ENCRYPTION_KEY`); anahtar yoksa kaydetme reddedilir; eski düz metin okunur                | `apps/api/src/modules/email/secret-box.ts`  |
| Migration              | Açılışta çalışmaz; hedef ortam iki kez yazılmadan ve production onayı olmadan çalışmaz                                            | `apps/api/scripts/migrate-release.mjs`      |

## İnceleme sonuçları (değişiklik gerektirmeyen)

- **SQL injection:** `$queryRawUnsafe`/`$executeRawUnsafe` yok; tüm sorgular Prisma veya etiketli `$queryRaw`.
- **Kimlik doğrulama:** global guard, varsayılan kapalı; 11 açık uç nokta bilinçli.
- **Şifreler:** argon2; şifre değişince tüm refresh token'lar iptal.
- **CSRF:** Panel API'ye sunucu tarafından Bearer token ile gider; Server Actions Next.js origin kontrolüyle korunur.
- **IDOR:** tenant JWT'den çözülür; public uç noktalar yalnızca yayınlanmış veriyi döner. Endpoint bazında tam inceleme Aşama 4'te preview üzerinde sürdürülecek.
- **Secret'lar:** kodda gizli değer yok.

## Açık kalanlar

1. **Refresh token rotation + yeniden kullanım tespiti:** Kodda bilerek kapalı. Panel token'ı cookie yazamayan Server Component'lerde yeniliyor; rotation açılırsa oturumlar düşer. Doğru yol: yenilemeyi panel middleware'ine taşımak (middleware cookie yazabilir), sonra API'de rotation + yeniden kullanımda tüm oturumları iptal. Çalışan bir preview'da test edilmeden açılmamalı (Aşama 4).
2. **CSP'yi zorunlu yapmak:** Report-Only ile en az bir hafta izlenip, entegrasyon alan adları netleşince `Content-Security-Policy` başlığına alınmalı.
3. **Rate limit:** API'deki sayaç instance başına. Giriş ve iletişim formu için Vercel Firewall kuralı veya paylaşılan sayaç (Upstash Redis) önerilir.
4. **Panel erişimi:** Vercel Deployment Protection veya IP kısıtı ile ek katman.
5. **Bağımlılık taraması:** CI'a `pnpm audit` eklenebilir.
6. **RLS:** [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md#rls).
7. **Seed varsayılan şifresi:** `prisma/seed.cjs` `ADMIN_PASSWORD` verilmezse zayıf bir varsayılan kullanır; yalnızca yerel/CI içindir, production'da çalıştırılmamalı.
