# Veritabanı ve Migration

Kapsam: Supabase `nexuva-os`, **yalnızca `public` şeması**. `core` şeması `nexuva-core`'a aittir; dokunulmaz.

## Mevcut durum (salt-okunur inceleme, 20.11.2026)

- Repodaki 12 migration'ın 12'si uygulanmış.
- `public._prisma_migrations` içinde **yarım kalmış kayıt**: `20260808120000_core_init` (16.08.2026, "type IdentityType already exists"). Bu migration bu repoda yok; `nexuva-core`'un migration'ı bu tabloya yazılmış görünüyor.
- Prisma yarım kalmış bir kayıt gördüğünde yeni migration uygulamaz (P3009). Panelin **Sistem** ekranı artık bunu "Veritabanı Şeması: bozuk" olarak gösterir.
- `storage_files`: 5 kayıt, 1'i aktif (verisi `storage_blobs`'ta). Verisi olmayan 4 kayıt **silinmiş** (soft delete) dosyalardır; kayıp veri yoktur.

## Dalda yapılan değişiklikler

**Şema değişikliği yok.** Yeni migration eklenmedi. Uygulama kodu mevcut tablolarla çalışır.

## Migration nasıl uygulanır (artık açılışta değil)

Vercel'de API açılırken migration çalışmaz. Ayrı ve kontrollü bir adım:

```
APP_ENV=<ortam> CONFIRM_MIGRATION=<ortam> DIRECT_URL=... DATABASE_URL=... \
  pnpm --filter @nexuva/api run migrate:release
```

Production için ayrıca `ALLOW_PRODUCTION_MIGRATION=yes` ve sahibin onayı gerekir. Script önce `migrate status` çalıştırır; yarım kayıt varsa durur.

## core_init kaydı — seçenekler (karar sahibin, yapılmadı)

| Seçenek                                                                                                                                                            | Ne yapar                                   | Risk                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------- |
| A. Ertelemek                                                                                                                                                       | Yeni migration gerekmedikçe dokunulmaz     | Yok; ancak ilk yeni migration'da engel olur |
| B. `prisma migrate resolve --rolled-back 20260808120000_core_init` (public şeması için)                                                                            | Kaydı "geri alındı" işaretler, satır kalır | Düşük; geçmiş korunur                       |
| C. Satırı yedekleyip silmek                                                                                                                                        | Kaydı kaldırır                             | Orta; geçmiş değişir                        |
| Öneri: **A**, yeni migration gerektiğinde **B**. Önce `nexuva-core`'un kendi migration tablosunun (`core._prisma_migrations`) sağlıklı olduğu ayrıca doğrulanmalı. |

## Önerilen gelecek migration'lar (onay bekliyor)

1. `website_services.slug` (nullable, unique per tenant) ve hizmet sayfası SEO alanları → slug'ları koddaki eşleştirmeden panele taşır.
2. Sayfa bazlı SEO tablosu (`page_seo`: path, title, description, ogImage, noIndex) → panelden yönetim.
3. Foreign key indeksleri: `contact_messages.assignedToId`, `content_versions.createdById`, `lead_activities.actorId`, `lead_notes.authorId`, `publish_logs.actorId`.
   Hepsi yalnızca ekleme; veri silmez. Önce dev veritabanında, sonra onayla production'da.

## Production / development ayrımı

Tek veritabanı var ve `production` işaretli. Preview ortamı için ayrı bir Supabase projesi veya branch gerekir (ücretli olabilir; onay). Yeni bir veritabanında `core_init` sorunu yoktur: `migrate:release` + `db:seed` ile kurulur.

## RLS

- `public` tablolarına yalnızca API, Prisma ile `postgres` rolüyle erişir (rol RLS'yi atlar).
- `anon` ve `authenticated` rollerinin `public`/`core` tablolarında **hiç yetkisi yok** ve bu şemalar için varsayılan yetki kuralı da yok. Supabase'in "RLS kapalı" uyarısının pratik riski bu yüzden düşük.
- Öneri: `public` tablolarında **tek tek**, önce dev'de, politikasız `ENABLE ROW LEVEL SECURITY` (Prisma etkilenmez). Toplu açılmaz; `core` kapsam dışı.
