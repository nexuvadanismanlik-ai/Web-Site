# Production Geçiş Kontrol Listesi

Her adım **sahibin açık onayıyla** yapılır. Her adımın geri dönüşü yazılıdır. Render, son adıma kadar çalışır kalır.

## Ön koşullar

- [ ] CI yeşil (`vercel-migration` dalı)
- [ ] Preview'da tüm Aşama 4 testleri geçti (site, API, admin, giriş, CMS, yayın + doğrulama, formlar, e-posta, dosya yükleme, analytics, sitemap/robots)
- [ ] Lighthouse mobil/masaüstü ölçüldü
- [ ] İçerik doğrulama listesi yanıtlandı (telefon, adres, rakamlar, sosyal hesaplar, marka tanımı)
- [ ] KVKK metni hukuken onaylandı
- [ ] Vercel planı ticari kullanıma uygun

## Adımlar

| #   | Adım                                                                                                                                                                                                         | Geri dönüş                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 1   | `nexuva-api` production ortam değişkenlerini gir (production DB, `APP_ENV=production`, Render'daki JWT secret'ları)                                                                                          | Değişkenleri sil; Render API çalışmaya devam eder        |
| 2   | `apps/api/vercel.json`'daki `main: false`'u kaldıran commit'i onayla, `nexuva-api` production deploy                                                                                                         | Vercel Instant Rollback / projeyi devre dışı bırak       |
| 3   | `nexuva-api` production'da health, giriş, içerik okuma                                                                                                                                                       | —                                                        |
| 4   | `nexuva-admin` production değişkenleri + deploy; giriş testi                                                                                                                                                 | Render admin çalışmaya devam eder                        |
| 5   | `nexuva` (site) production değişkenleri: `NEXT_PUBLIC_API_URL` → yeni API, `NEXT_PUBLIC_SITE_URL`, `REVALIDATE_SECRET`                                                                                       | Eski değere geri al + Instant Rollback                   |
| 6   | `vercel-migration` → `main` birleştirme (site ISR'ye geçer). **Not:** `main` Render'ı da otomatik deploy eder; Render servisleri bu noktada yeni kodu alır (`RENDER_DEPLOY_HOOK_URL` geçiş için hâlâ okunur) | `main`'i önceki commit'e döndür; Vercel Instant Rollback |
| 7   | API'de `PUBLISH_STRATEGY=revalidate`, `FRONTEND_REVALIDATE_*`, `SITE_URL`; panelden test yayını → "doğrulandı"                                                                                               | Stratejiyi eski haline al                                |
| 8   | Panelde canonical/SEO alanları, LogiOps bağlantıları, onrender.com içeren içerik düzeltilip yayınlanır                                                                                                       | Önceki sürüm geçmişte; yeniden yayınlanabilir            |
| 9   | Resend alan adı doğrulaması, `RESEND_API_KEY`, test e-postası                                                                                                                                                | Anahtarı kaldır                                          |
| 10  | Kalıcı alan adı + DNS (ayrı onay)                                                                                                                                                                            | DNS kaydını geri al (TTL kadar sürer)                    |
| 11  | Search Console + Bing Webmaster doğrulama, sitemap gönderimi, IndexNow anahtarı                                                                                                                              | —                                                        |
| 12  | En az 1–2 hafta gözlem (hata logları, form kayıtları, yayın geçmişi)                                                                                                                                         | —                                                        |
| 13  | **Ayrı onayla** Render servislerini durdur (silmeden), bir süre sonra kaldır; Render değişkenlerini ve `render.yaml`'ı sil                                                                                   | Servisi yeniden başlat                                   |

## Production'da yapılmayacaklar (onaysız)

Migration, veri düzeltme, `core_init` kaydı, RLS, DNS, Render kapatma, ücretli servis açma.
