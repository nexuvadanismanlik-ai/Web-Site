# Ortamlar

Bu proje dört ortam kullanır. Hiçbiri diğerinin veritabanına yazmaz.

| Ortam | `APP_ENV` | Veritabanı | Kim kullanır |
|---|---|---|---|
| **local** | `local` | Geliştiricinin kendi Supabase projesi (veya yerel Postgres) | Geliştirici makinesi |
| **development** | `development` | Paylaşılan dev Supabase projesi | Otomatik testler, entegrasyon denemeleri |
| **staging** | `staging` | Staging Supabase projesi | Yayın öncesi son kontrol |
| **production** | `production` | Üretim Supabase projesi | Canlı site |

## Neden bu ayrım var

Bir süre yerel geliştirme doğrudan üretim veritabanına bağlıydı. Sonucu şuydu:
doğrulama betikleri gerçek yayın geçmişine test kaydı yazdı, gerçek mesajları
okundu işaretledi. Bağlantı adresi bakışta ayırt edilemediği için "şu an nereye
yazıyorum?" sorusunun cevabı her seferinde dikkatli okumaya kalıyordu — ve bir
kez yanlış cevaplandı.

## Nasıl korunuyor

**Veritabanı kendi ortamını söylüyor.** İlk bağlanan uygulama
`system_settings` tablosuna `platform.environment` satırını yazar. Sonrasında
farklı bir `APP_ENV` ile bağlanan her süreç **başlamayı reddeder**:

```
Environment mismatch: this process is APP_ENV=local, but the database at
aws-0-eu-central-1.pooler.supabase.com:5432 is marked "production".
```

Host adından üretimi tahmin etmeye çalışmıyor — tahmin yanılır. Veritabanı ne
olduğunu kendisi beyan ediyor.

Gerçekten gerekiyorsa (üretime elle migration gibi) tek bir yolu var ve adı ne
yaptığını söylüyor:

```
DANGEROUSLY_ALLOW_ENV_MISMATCH=true
```

## Kurulum — yapılması gerekenler

Kod tarafı hazır; eksik olan ayrı veritabanları. Sırasıyla:

### 1. Dev Supabase projesi oluştur

[supabase.com](https://supabase.com) → New project → `nexuva-dev`.
Bağlantı adresini **Connection string → URI** altından al.

### 2. `apps/api/.env` dosyanı dev'e çevir

```env
APP_ENV=local
DATABASE_URL=<dev projesinin connection string'i>
DIRECT_URL=<dev projesinin direct connection string'i>
```

Üretim adresi artık burada durmamalı.

### 3. Şemayı ve içeriği kur

```bash
pnpm --filter @nexuva/api exec prisma migrate deploy
pnpm --filter @nexuva/api run db:seed
```

Seed, ilk yayınlanmış içerik sürümünü de oluşturur — site yayınlanmış sürüm
olmadan çalışmaz, bu bilerek böyledir.

### 4. Üretim ortamını işaretle

Üretim API'si bir sonraki açılışında `APP_ENV=production` ile başlamalı.
Render → backend servisi → Environment:

```
APP_ENV=production
```

Bu değer eklenene kadar guard üretim veritabanını `local` diye işaretleyebilir;
o durumda satırı düzeltmek gerekir:

```sql
UPDATE system_settings SET value = '"production"' WHERE key = 'platform.environment';
```

### 5. Staging (isteğe bağlı, sonra)

Aynı adımlar, `APP_ENV=staging` ve ayrı bir Supabase projesiyle.

## Yazan betikler

`scripts/verify-*.mjs` altındaki doğrulayıcılardan yalnızca `verify-chain` ve
`verify-api-contract` salt-okunurdur; üretime karşı çalıştırılabilirler.

`verify-collection-identity` ve `verify-versioning` **yazar**. İkincisi dört kez
yayın yapar ve yayın geçmişine kayıt ekler. Bunlar yalnızca local veya
development ortamına karşı çalıştırılmalıdır.

## Yayın geçmişi silinmez

`publish_logs` ve `content_versions` denetim kayıtlarıdır. Kim ne zaman neyi
yayınladı sorusunun cevabıdır ve sonradan düzeltilmez. Test kaydı oluşmasın diye
geçmiş temizlenmez — test ayrı ortamda çalıştırılır.
