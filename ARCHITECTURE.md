# Mimari

Bu belge dondurulmuş mimariyi tanımlar. Sonraki fazlar bu yapının **üzerine**
özellik ekler; yapıyı değiştirmez.

Her kural bir gerekçeyle yazıldı. Gerekçesi anlaşılmayan kural, ilk sıkışıkta
delinir.

---

## 1. Katmanlar

```
Controller        HTTP sözleşmesi. İş mantığı yok.
  ↓
Service           İş mantığı. Başka modülün tablosunu bilmez.
  ↓
Repository        Sorgu inşası: tenant kapsamı, soft-delete, projeksiyon, sayfalama.
  ↓
Prisma            Veritabanı.
```

### Repository ne yapar, ne yapmaz

Repository **sorguyu sahiplenir**. Servis "aktif hizmetleri sırayla getir" der;
hangi kolonların seçileceğini, `deletedAt: null` filtresinin ekleneceğini,
`tenantId`'nin nasıl kapsanacağını repository bilir.

Repository **geçiş katmanı değildir**. `findById(id)` yazıp içinde
`prisma.x.findUnique({ where: { id } })` çağırmak, Prisma'yı yeniden
adlandırmaktan ibarettir: dosya sayısını ikiye katlar, hiçbir şeyi soyutlamaz.
Böyle bir metot yazılacaksa servis doğrudan repository'nin anlamlı bir metodunu
çağırmalıdır.

Kazanç şurada somutlaşır: bugün `tenantId` kapsaması ve soft-delete filtresi
servislerin içinde onlarca kez tekrarlanıyor. Biri unutulduğunda sessizce başka
tenant'ın verisi görünür. Repository bunu tek yerde tutar.

---

## 2. Modül sınırları

Hiçbir modül başka modülün Prisma modeline dokunmaz.

```
✅  this.notifications.create({ ... })      // public servis
❌  this.prisma.notification.create({ ... }) // başka modülün tablosu
```

Bir modül kendi tablolarını repository'si üzerinden okur. Başka modülün
verisine yalnızca o modülün **public servisi** üzerinden erişir.

Bu kural ERP, AI ve Customer Portal modülleri geldiğinde kritik: bugün
`prisma.notification` yazan bir modül, yarın bildirim mantığı değiştiğinde
sessizce bozulur.

Modüller: `website`, `crm`, `analytics`, `media`, `seo`, `blog`,
`notifications`, `auth`, `users`, `storage`.

---

## 3. Olaylar

Bir işlemin yan etkileri birbirini çağırmaz. Olay yayınlanır, dinleyenler kendi
işini yapar.

```
❌  createLead() → sendEmail() → createNotification() → writeActivity() → trackEvent()

✅  createLead() → emit(LeadCreated)
                     ├─ EmailListener
                     ├─ NotificationListener
                     ├─ ActivityListener
                     └─ AnalyticsListener
```

Sebep: zincirin ortasındaki bir hata, zincirin başındaki işlemi düşürmemeli.
Bugün iletişim formu bunu elle yapıyor — e-posta beklenmeden gönderiliyor ve
hatası yutuluyor. Olay sistemi bunu kural hâline getirir.

Bir dinleyicinin başarısızlığı olayı yayınlayanı etkilemez ve loglanır.

---

## 4. Uzun süren işler

HTTP isteği içinde çalışmayacak olanlar:

deploy · e-posta · analitik toplama · SEO üretimi · OG görseli · içe aktarma ·
dışa aktarma · yedekleme

Bunlar `JobQueue` arayüzü üzerinden kuyruğa verilir. Bugünkü uygulama süreç
içinde çalıştırır (`InlineJobQueue`); gerçek kuyruk sonradan aynı arayüzün
arkasına takılır. Çağıran kodun değişmesi gerekmez.

---

## 5. Yapılandırma

`process.env` yalnızca `apps/api/src/config/*.config.ts` ve Next.js'in build
zamanı `NEXT_PUBLIC_*` okumalarında geçer. Başka hiçbir yerde okunmaz.

Tek istisna ve sebebi: `apps/api/src/main.ts`, Fastify adaptörünü ConfigModule
yüklenmeden önce kurmak zorunda. Bu okumalar `config/app.config.ts` içindeki
çözümleyicilerden geçer, ham `process.env` erişimi değildir.

---

## 6. API sözleşmesi

Başarı:

```json
{ "success": true, "message": "", "data": { } }
```

Hata:

```json
{ "success": false, "statusCode": 400, "errorCode": "VALIDATION_FAILED", "message": "...", "timestamp": "...", "path": "..." }
```

Merkezî `TransformInterceptor` ve `HttpExceptionFilter` uygular. Handler kendi
zarfını kurmaz.

**Sürümleme:** tüm yollar `/api/v1/...` altında. `v2` geldiğinde `v1` çalışmaya
devam eder; kırıcı değişiklik yeni namespace açar.

**Listeler:** sınırsız büyüyebilen her liste `PaginationQueryDto` kullanır
(`page`, `limit`, `search`, `sortBy`, `sortOrder`) ve `{ data, meta }` döner.
Sabit boyutlu içerik koleksiyonları (6 hizmet, 12 logo) bunun dışındadır —
editör onları tek dizi olarak kaydeder.

`sortBy` doğrudan `orderBy`'a geçmez; her uç izin verilen kolonları beyan eder.

---

## 7. Tasarım sistemi

Tüm arayüz bileşenleri `packages/ui` içinde:

```
packages/ui/src/
  components/
    forms/        SelectField, NumberField, DateField, SwitchField, SearchBar...
    feedback/     Toast, EmptyState, Skeleton, ConfirmDialog...
    layout/       Panel, PageHeader...
    navigation/   Breadcrumb, Tabs...
    tables/       DataTable, Pagination, FilterBar...
    charts/       (Faz 5)
    icons/
  styles/         Bileşenlerin dayandığı sınıflar
  index.ts        Tek çıkış noktası
```

Uygulamalar **yalnızca** `@nexuva/ui` üzerinden import eder. Dosya yoluna
doğrudan erişilmez.

Paket tükettiği stilleri kendi taşır. Bir bileşen `apps/admin` içinde tanımlı
bir sınıfa dayanamaz — o sınıf `apps/web` içinde yoksa bileşen orada bozulur, ki
bu iki uygulamanın `globals.css` dosyalarının neden altı sınıfı ve on iki temayı
ayrı ayrı tanımladığının da cevabıdır.

Tema değişkenleri (`--c-fg`, `--c-card`) uygulamada kalır; bileşenler onları
Tailwind preset'i üzerinden semantik isimle (`text-fg`, `bg-card`) tüketir.
Böylece aynı bileşen sitede ve panelde farklı temayla çalışır.

**Yeni bileşen kuralı:** bir ekran ihtiyaç duyduğu bileşeni önce `packages/ui`
içine ekler. Ekranın içine bileşen yazılmaz.

---

## 8. Dashboard

Dashboard bir **birleştirme katmanıdır**. İş mantığı içermez, kendi sorgusunu
yazmaz.

Her modül kendi özetini kendi servisinde üretir; Dashboard onu okur ve gösterir.

```
✅  const crm = await this.crm.summary(tenantId)
❌  const won = await this.prisma.contactMessage.count({ where: { status: 'WON' } })
```

Yeni faz Dashboard'u değiştirmez; kendi servisine bir `summary()` ekler ve
Dashboard onu listeye alır.

---

## 9. Gözlemlenebilirlik

Her istek bir `requestId` taşır. Her hata kaydı şunlarla ilişkilendirilir:

`requestId` · `traceId` · `userId` · `tenantId` · `path` · `statusCode`

Hata yanıtı `requestId` döndürür, böylece kullanıcının bildirdiği hata logda
tek sorguyla bulunur.

---

## 10. Migration politikası

- Her migration `prisma migrate` ile üretilir; elle SQL yazılmaz.
- Her migration idempotent olmalıdır — iki kez uygulanması hata vermemelidir.
- Geri alınabilir olmalıdır: yıkıcı bir değişiklik (kolon silme, tip daraltma)
  iki adımda yapılır — önce yeni yapı eklenir ve doldurulur, eski yapı bir
  sonraki sürümde kaldırılır.
- Veri taşıyan migration'lar `prisma/migrations/README.md` içinde açıklanır.

---

## 11. Test

Her modül şunlarla birlikte teslim edilir:

| Tür | Kapsam | Nerede |
|---|---|---|
| **Unit** | Saf mantık: hesaplama, dönüşüm, doğrulama | `*.spec.ts`, servis yanında |
| **Contract** | Uç sözleşmesi: zarf, hata kodu, sayfalama | `scripts/verify-api-contract.mjs` |
| **Integration** | Servis + repository + veritabanı | `*.integration.spec.ts` |
| **Smoke** | Canlı sistemde uçtan uca | `scripts/verify-*.mjs` |

Yazan doğrulayıcılar yalnızca `local`/`development` ortamına karşı çalışır.

---

## 12. Performans bütçesi

| Ölçüt | Hedef |
|---|---|
| API p95 gecikme | < 300 ms (soğuk başlatma hariç) |
| Admin ilk yükleme JS | < 300 KB |
| Site ilk yükleme JS | < 200 KB |
| İstek başına N+1 sorgu | 0 |
| Sayfa başına API çağrısı | ≤ 1 (aynı veri için) |

Bütçeyi aşan bir değişiklik, aşma gerekçesiyle birlikte tartışılır.

---

## 13. Tekrar yasağı

Yeni dosya son seçenektir. Sırasıyla:

1. Var olan yapı genişletilebilir mi?
2. Var olan bileşen/parametre yeterli mi?
3. Ancak o zaman yeni dosya.

Yasak: aynı bileşenin ikinci kopyası, aynı hook'un ikinci kopyası, aynı DTO'nun
ikinci tanımı, aynı yardımcının ikinci yazımı, aynı sorgunun ikinci inşası.

---

## 14. Faz bitiş kriteri

Bir faz şunlar tamamlanmadan bitmiş sayılmaz:

Kod · Test · Responsive · Dark Mode · Erişilebilirlik · Typecheck · Lint ·
Build · Verify betiği · Dokümantasyon

---

## Bu mimari dondurulmuştur

Sonraki fazlar bu yapıyı değiştirmez. Bir kural gerçekten yanlışsa, kod yazarak
delinmez — kural tartışılır ve bu belge güncellenir.
