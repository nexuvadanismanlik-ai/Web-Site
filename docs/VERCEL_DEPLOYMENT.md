# Vercel Kurulumu ve Dağıtım

Bu belge Aşama 3'te uygulanacak kurulumu tarif eder. **Production deploy, alan adı/DNS değişikliği, production migration ve Render'ın kapatılması sahibin açık onayı olmadan yapılmaz.**

## 1. Projeler

| Proje                 | Root Directory | Framework | Install                          | Build                                                   |
| --------------------- | -------------- | --------- | -------------------------------- | ------------------------------------------------------- |
| `nexuva` (mevcut)     | `apps/web`     | Next.js   | varsayılan (pnpm, monorepo kökü) | `turbo run build` (Vercel otomatik)                     |
| `nexuva-api` (yeni)   | `apps/api`     | NestJS    | `apps/api/vercel.json`           | `apps/api/vercel.json` (`@nexuva/shared` önce derlenir) |
| `nexuva-admin` (yeni) | `apps/admin`   | Next.js   | `apps/admin/vercel.json`         | `apps/admin/vercel.json`                                |

Her üç projede **Function Region: `fra1`** (vercel.json'da `regions`). Veritabanı eu-central-1 (Frankfurt) olduğu için.

### Otomatik deploy korumaları (dalda)

- `apps/web/vercel.json`: `vercel-migration` dalı için otomatik deploy **kapalı**. Sebep: `nexuva` projesindeki `NEXT_PUBLIC_API_URL` şu an production ve preview için aynı; bu dalın preview'u production API'ye (ve veritabanına) bağlanırdı. Preview ortam değişkenleri ayrıldıktan sonra bu satır kaldırılır.
- `apps/api/vercel.json`, `apps/admin/vercel.json`: `main` dalı için otomatik deploy **kapalı**. Production'a geçiş onaylanana kadar yeni projeler yalnızca preview üretir. Geçişte bu satırlar kaldırılır.

## 2. NestJS + Fastify doğrulaması (Aşama 4)

Vercel NestJS'i `src/main.ts` girişinden sıfır yapılandırmayla çalıştırır; uygulama tek bir Function olur. Fastify adaptörü Vercel dokümanında ayrıca belirtilmez — **ilk preview'da doğrulanmalı**: `/api/v1/health`, giriş, dosya yükleme (multipart), rate limit başlıkları. Çalışmazsa yalnızca bir giriş dosyası eklenir (Fastify örneğini Vercel handler'ına bağlayan); iş mantığı değişmez.

## 3. Ortam ayrımı

|       | Production                                          | Preview                                                              |
| ----- | --------------------------------------------------- | -------------------------------------------------------------------- |
| Site  | production API, `NEXT_PUBLIC_SITE_URL`=kalıcı adres | preview API, `noindex` (otomatik), `NEXT_PUBLIC_SITE_URL` ayarlanmaz |
| API   | `nexuva-os`, `APP_ENV=production`                   | **ayrı dev veritabanı**, `APP_ENV=development`                       |
| Admin | production API                                      | preview API                                                          |

API, veritabanındaki `platform.environment` işaretiyle `APP_ENV`'i karşılaştırır; uyuşmazsa açılmaz. Preview'u production veritabanına bağlamak bu yüzden de başarısız olur.

## 4. Değişkenleri ekleme

Değişken listesi: [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md). Vercel panelinde: **Project → Settings → Environment Variables → Add**, ortamı (Production / Preview) seçin, gizli değerleri **Sensitive** işaretleyin. Değerler sohbete veya repoya yazılmaz.

## 5. Revalidation için firewall kuralı (önerilen)

`nexuva` projesinde **Firewall → Rules**: `/api/revalidate` yoluna IP başına dakikada 10 istek. Uygulama içi sınır instance başınadır; bu kural paylaşılan sınırdır.

## 6. Yayın akışını açma

API'de: `PUBLISH_STRATEGY=revalidate`, `FRONTEND_REVALIDATE_URL=https://<site>/api/revalidate`, `FRONTEND_REVALIDATE_SECRET=<site'taki REVALIDATE_SECRET ile aynı>`, `SITE_URL=https://<site>`.

## 7. Geri alma

Vercel **Instant Rollback** ile önceki production deploy'una dönülür. Ayrıntı: [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).
