# Testler

## Komutlar

| Komut                                                                   | Ne test eder                                                                                                                                                                                         | Veritabanı                                                                                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @nexuva/web test`                                        | SEO yardımcıları (origin, canonical, noindex, JSON-LD kaçışı, sosyal link, doğrulanmamış bilgiler, slug), revalidation kararları (gizli anahtar, boyut, tür, tag/path, rate limit)                   | Yok                                                                                                        |
| `pnpm --filter @nexuva/web run test:build`                              | Derlenmiş sitenin HTML'i: sayfa başına tek ve doğru canonical, benzersiz title/description, tek H1, Render adresi yok, JSON-LD geçerli, FAQ yalnızca görünen sorular, 404 noindex, sitemap ve robots | Yok (fixture)                                                                                              |
| `pnpm --filter @nexuva/api run build && pnpm --filter @nexuva/api test` | Yayın doğrulaması (sürüm okuma, yeniden deneme, eski sürüm = başarısız), dosya türü ve SVG güvenliği, mail şifreleme, AI kaynak sınıflaması, IndexNow, mevcut doğrulama borusu testleri              | Yok                                                                                                        |
| `node --test "apps/api/test/e2e/*.e2e.mjs"`                             | Çalışan API'ye karşı: health, yetkisiz erişim, giriş/yanlış şifre, refresh, yayınlanmış içerik, iletişim formu (geçerli/geçersiz/honeypot), stratejisiz yayının başarısız raporlanması               | **Geçici** PostgreSQL (CI). `E2E_ALLOW_WRITES=yes` olmadan çalışmaz; production'a karşı çalışmayı reddeder |

## Site derlemesi için fixture

```
NEXUVA_CONTENT_FIXTURE=test/fixtures/site-content.json \
NEXT_PUBLIC_SITE_URL=https://nexuva.example \
pnpm --filter @nexuva/web build
```

Fixture yalnızca CI ve yerel içindir; Vercel production deploy'unda reddedilir.

## CI

`.github/workflows/ci.yml` her push ve PR'da: typecheck (3 uygulama), lint, API build + birim testleri, site birim testleri, site build + SEO kontrolleri, admin build; ayrı işte geçici PostgreSQL ile migration + seed + API + e2e. Gizli değer gerektirmez; kimlik bilgileri her çalıştırmada üretilir.

## Bu oturumda doğrulananlar / doğrulanamayanlar

- Çalıştırıldı ve geçti: 3 uygulamanın typecheck'i, lint (0 hata), site birim testleri (18), site build + SEO kontrolleri (11), API build + birim testleri (17), admin build.
- **Çalıştırılamadı:** e2e testleri ve CI'ın kendisi. Bu ortamda Prisma motor dosyaları ve Google Fonts indirilemiyor; veritabanına bağlanan hiçbir test burada koşmadı. İlk CI çalışması bunları doğrulayacak.

## Lighthouse / Core Web Vitals

Henüz ölçülmedi (bu ortamdan erişilemiyor). Aşama 4'te preview üzerinde PageSpeed Insights (mobil + masaüstü) ve Vercel Speed Insights ile ölçülecek; sonuçlar bu dosyaya eklenecek.
