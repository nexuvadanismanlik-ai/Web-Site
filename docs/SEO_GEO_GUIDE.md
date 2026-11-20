# SEO ve GEO Rehberi

## Ne yapıldı (dalda)

### Teknik SEO

- **Tek site adresi:** `NEXT_PUBLIC_SITE_URL` (yoksa Vercel production alan adı). Panelin canonical alanı okunmaz.
- **Sayfa başına metadata** (`lib/seo.ts → pageMetadata`): özgün title, description, canonical (sonda `/`), Open Graph, Twitter Card, `hreflang` (`tr-TR` + `x-default`).
- **Robots meta:** yalnızca sapma yazılır. Preview deploy'ları otomatik `noindex`. Paneldeki "arama motorlarından gizle" anahtarı tüm siteyi kapatır.
- **404:** Türkçe `not-found.tsx`, tek `noindex`, canonical yok, HTTP 404.
- **301:** `/tr`, `/tr/*`, `/en`, `/en/*` → kök (gerçek yönlendirme).
- **Sitemap:** sabit sayfalar + 8 hizmet sayfası; `lastModified` yayın tarihidir (build tarihi değil). `noindex` başvuru sayfası listelenmez.
- **robots.txt:** arama ve yapay zekâ botları açıkça listelenir, `/api/` kapalı, sitemap satırı doğru adreste.
- **Breadcrumb:** görünür iz + `BreadcrumbList` (aynı diziden).
- **Hizmet sayfaları:** `/services/{google-ads, meta-ads, seo, kurumsal-web-sitesi, landing-page, marka-danismanligi, otomasyon, logiops-entegrasyonu}` — özgün H1, kapsam, kimler için, süreç, SSS, ilgili hizmetler, `Service` + `WebPage` şeması. Kartlardan iç bağlantı.
- **JSON-LD:** `Organization`, `WebSite`, hizmet `ItemList`, sayfa bazında `Service`, `WebPage`, `SoftwareApplication` (LogiOps), `BreadcrumbList`, `FAQPage` (yalnızca sayfada görünen sorular için).
- **XSS:** JSON-LD `serializeJsonLd` ile `<`, `>`, `&` kaçışlı.
- **Font:** Playfair'den kullanılmayan 500 ağırlığı çıkarıldı (2 font dosyası daha az).

### GEO

- **Tek marka tanımı:** `lib/brand-identity.ts` (onay bekliyor). llms.txt, ana sayfa SSS ve şema buradan okur.
- **LogiOps** her yerde "Nexuva'nın geliştirdiği ayrı ürün" olarak tanımlanır.
- **llms.txt:** tanım, iletişim (yalnızca doğrulanmış bilgiler), hizmet sayfası bağlantıları, ürünler, bugün mevcut / vizyon ayrımı, sayfalar, sitemap.
- **Doğrulanmamış bilgiler makinelere söylenmez:** telefon, adres (`lib/verified-facts.ts`), genel sosyal medya ana sayfaları (`isProfileUrl`). Görünür sayfa paneldeki içeriği göstermeye devam eder; düzeltmesi paneldendir.
- **AI referral ölçümü:** analytics kaynakları `ai:chatgpt`, `ai:perplexity`, `ai:claude`, `ai:gemini`, `ai:copilot`… olarak sınıflanır (referrer ve `utm_source`).
- **IndexNow:** doğrulanmış her yayından sonra ana sayfalar bildirilir (`INDEXNOW_KEY`). Anahtar `/indexnow-key.txt`'de sunulur.

## Sahibin onayı / bilgisi gereken içerik

| Konu                                                          | Durum                                                |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| Marka tanımı (`BRAND_DEFINITION`)                             | Taslak; onay bekliyor                                |
| Hizmet sayfası metinleri (`lib/service-details.ts`)           | Taslak; rakam/garanti içermez, gözden geçirilmeli    |
| Telefon, adres                                                | Doğrulanmadı; JSON-LD/llms.txt'de yok                |
| "120'den fazla marka", "8+ yıl", "Türkiye'nin öncü markaları" | Panelde duruyor; doğrulanmazsa panelden kaldırılmalı |
| Sosyal medya hesapları                                        | Gerçek profil adresleri girilmeli                    |
| Ana sayfa H1 ("Geleceğin işini…")                             | Arama niyeti taşımıyor; panelden değiştirilebilir    |

## Ölçüm kurulumu (sahip tarafından)

1. **Google Search Console:** alan adı mülkü (DNS TXT) veya URL öneki; doğrulama kodu panel → Entegrasyonlar → Google site doğrulama. Sitemap: `https://<site>/sitemap.xml`.
2. **Bing Webmaster Tools:** Search Console'dan içe aktarma veya `msvalidate.01` kodu (panel). IndexNow anahtarı aynı.
3. **GA4 / GTM / Clarity / Meta Pixel:** kimlikler panelden; format doğrulanır, yanlış biçim yüklenmez. Çerez onayı gereksinimi KVKK danışmanıyla değerlendirilmeli.
4. **Vercel Web Analytics / Speed Insights:** proje panelinden açılabilir; paket eklenmesi gerekir (onayla).

## Beklenti

llms.txt veya robots.txt yapay zekâ sistemlerinde görünürlüğü garanti etmez. Etkiyi; doğru indekslenme, tutarlı kimlik bilgisi, kaliteli sayfalar ve başka sitelerde Nexuva'dan söz edilmesi belirler.
