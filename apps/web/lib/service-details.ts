import type { FaqItem } from '../components/faq';
import { BRAND_DEFINITION, LOGIOPS_DEFINITION } from './brand-identity';

/**
 * The long-form copy for each service page.
 *
 * The panel holds a title, a two-sentence description and three bullets per
 * service — enough for a card, not for a page someone lands on from a search.
 * This file supplies the rest, keyed by the agreed slug.
 *
 * Rules this copy follows, and any edit to it should too:
 *   - It describes the work, not results. No percentages, client counts,
 *     rankings or guarantees: none of them can be verified here, and a claim a
 *     language model repeats is a claim Nexuva is answerable for.
 *   - Every answer stands on its own, because that is how it gets quoted.
 *   - Nothing here is the panel's job: when the CMS migration for service
 *     pages lands (DATABASE_MIGRATION.md), this moves into the panel.
 *
 * Status: draft for owner review before production.
 */
export interface ServiceDetail {
  /** The page's H1. Names the service and the intent, not a slogan. */
  heading: string;
  /** <title>; the layout appends " | Nexuva". */
  metaTitle: string;
  /** ≤ 160 characters. */
  metaDescription: string;
  /** Opening paragraphs: what it is and who it is for. */
  intro: string[];
  /** Who this is a fit for. */
  forWhom: string[];
  /** What the work includes, beyond the card's bullets. */
  scope: string[];
  /** How the work proceeds, in order. */
  steps: { title: string; body: string }[];
  faq: FaqItem[];
  /** Slugs of the services most often needed alongside this one. */
  related: string[];
}

export const SERVICE_DETAILS: Record<string, ServiceDetail> = {
  'google-ads': {
    heading: 'Google Ads yönetimi',
    metaTitle: 'Google Ads Yönetimi — Arama, Görüntülü ve Alışveriş Kampanyaları',
    metaDescription:
      'Google Ads kampanyalarının kurulumu, dönüşüm takibi ve haftalık optimizasyonu. Bütçenizi dönüşüm getiren aramalara yönlendiren, ölçülebilir reklam yönetimi.',
    intro: [
      'Google Ads yönetimi; arama, görüntülü ve alışveriş kampanyalarının kurulması, ölçümünün doğru yapılandırılması ve bütçenin sonuç getiren aramalara yönlendirilmesi işidir.',
      'Nexuva kampanyaları haftalık olarak izler ve teklif stratejisini verilere göre günceller. Amaç tıklama sayısını değil, form, arama veya satış gibi işletmeniz için anlamlı olan dönüşümleri artırmaktır.',
    ],
    forWhom: [
      'Ürün veya hizmetini aktif olarak arayan müşterilere ulaşmak isteyen işletmeler',
      'Mevcut kampanyalarının neden sonuç vermediğini anlamak isteyen ekipler',
      'Reklam harcamasını dönüşüm verisine göre yönetmek isteyen firmalar',
    ],
    scope: [
      'Hesap ve kampanya yapısının kurulması veya mevcut hesabın denetlenmesi',
      'Anahtar kelime ve negatif anahtar kelime planı',
      'Reklam metinleri ve uzantıları',
      'Google Analytics 4 ve Google Ads dönüşüm takibinin kurulumu',
      'Teklif stratejisi ve bütçe dağılımı',
      'Aylık performans raporu',
    ],
    steps: [
      {
        title: 'Hedef ve ölçüm',
        body: 'Hangi eylemin dönüşüm sayılacağı belirlenir ve ölçüm kurulur.',
      },
      { title: 'Kurulum', body: 'Kampanya yapısı, anahtar kelimeler ve reklamlar hazırlanır.' },
      {
        title: 'Yayın ve izleme',
        body: 'Kampanyalar haftalık izlenir, harcama ve aramalar kontrol edilir.',
      },
      {
        title: 'Optimizasyon ve rapor',
        body: 'Teklifler ve bütçe verilere göre güncellenir, sonuçlar raporlanır.',
      },
    ],
    faq: [
      {
        question: 'Google Ads yönetimi neleri kapsar?',
        answer:
          'Nexuva’nın Google Ads yönetimi; kampanya yapısının kurulmasını, anahtar kelime ve reklam metni hazırlığını, dönüşüm takibinin yapılandırılmasını, kampanyaların haftalık izlenmesini, teklif ve bütçe optimizasyonunu ve aylık performans raporunu kapsar.',
      },
      {
        question: 'Mevcut Google Ads hesabımla çalışabilir misiniz?',
        answer:
          'Evet. Çalışma, mevcut hesabın yapısı, harcaması ve dönüşüm ölçümünün denetlenmesiyle başlar. Hesap ve geçmiş veriler işletmenizde kalır.',
      },
      {
        question: 'Reklam bütçesi Nexuva ücretine dahil mi?',
        answer:
          'Hayır. Google’a ödenen reklam bütçesi ile yönetim hizmeti birbirinden ayrıdır. Reklam harcaması doğrudan sizin Google Ads hesabınızdan yapılır.',
      },
    ],
    related: ['landing-page', 'meta-ads', 'seo'],
  },

  'meta-ads': {
    heading: 'Meta reklam yönetimi (Facebook ve Instagram)',
    metaTitle: 'Meta Reklam Yönetimi — Facebook ve Instagram Reklamları',
    metaDescription:
      'Facebook ve Instagram reklamlarının hedef kitle, kreatif ve teklif düzeyinde yönetimi. Piksel ve olay kurulumu, kreatif testleri ve yeniden pazarlama.',
    intro: [
      'Meta reklam yönetimi; Facebook ve Instagram reklamlarının hedef kitle, kreatif ve teklif düzeyinde planlanması, test edilmesi ve ölçeklenmesidir.',
      'Nexuva reklam setlerini test ederek ilerletir: çalışan kurgu bütçe alır, çalışmayan durdurulur. Bunun için Meta Pikseli ve dönüşüm olaylarının doğru kurulması temel şarttır.',
    ],
    forWhom: [
      'Ürününü görsel olarak anlatabilen ve yeni kitlelere ulaşmak isteyen markalar',
      'Siteyi ziyaret etmiş ama dönüşmemiş kişilere yeniden ulaşmak isteyen işletmeler',
      'Reklam kreatiflerini veriyle karşılaştırmak isteyen ekipler',
    ],
    scope: [
      'Reklam hesabı, Business Manager ve ödeme yapısının kontrolü',
      'Meta Pikseli ve dönüşüm olaylarının kurulumu',
      'Hedef kitle ve yeniden pazarlama kitleleri',
      'Kreatif testleri ve varyasyon planı',
      'Bütçe ve teklif yönetimi',
      'Performans raporu',
    ],
    steps: [
      { title: 'Ölçüm altyapısı', body: 'Piksel ve olaylar kurulur, veri akışı doğrulanır.' },
      {
        title: 'Kitle ve kreatif',
        body: 'Test edilecek kitleler ve kreatif varyasyonlar hazırlanır.',
      },
      {
        title: 'Test',
        body: 'Reklam setleri kontrollü bütçeyle yayına alınır ve karşılaştırılır.',
      },
      { title: 'Ölçekleme', body: 'Sonuç veren kurgu büyütülür, vermeyen durdurulur.' },
    ],
    faq: [
      {
        question: 'Meta reklam yönetimi hangi platformları kapsar?',
        answer:
          'Meta reklam yönetimi Facebook ve Instagram reklamlarını kapsar. Reklamlar tek bir Meta reklam hesabından yönetilir ve her iki platformda gösterilebilir.',
      },
      {
        question: 'Meta Pikseli neden gerekli?',
        answer:
          'Meta Pikseli, sitenizde gerçekleşen form gönderimi veya satın alma gibi eylemleri Meta’ya bildirir. Bu veri olmadan reklamların hangi sonucu ürettiği ölçülemez ve yeniden pazarlama kitleleri oluşturulamaz.',
      },
      {
        question: 'Kreatif testi nasıl yapılır?',
        answer:
          'Aynı hedef kitleye farklı görsel, video veya metin varyasyonları kontrollü bütçeyle gösterilir. Belirli bir süre sonunda dönüşüm verisine göre en iyi sonuç veren varyasyon ölçeklenir.',
      },
    ],
    related: ['google-ads', 'landing-page', 'marka-danismanligi'],
  },

  seo: {
    heading: 'SEO hizmeti: teknik denetim, içerik ve ölçüm',
    metaTitle: 'SEO Hizmeti — Teknik SEO Denetimi ve İçerik Planı',
    metaDescription:
      'Teknik SEO denetimi, anahtar kelime ve içerik planı, site içi yapı ve sıralama takibi. Sitenizi arama motorlarının doğru anlayacağı hâle getiren SEO çalışması.',
    intro: [
      'SEO (arama motoru optimizasyonu), bir web sitesinin teknik altyapısını, içeriğini ve site içi yapısını arama motorlarının doğru anlayıp sıralayabileceği hâle getirme çalışmasıdır.',
      'Nexuva’nın SEO çalışması teknik denetimle başlar; ardından anahtar kelime ve içerik planı hazırlanır ve sonuçlar düzenli olarak ölçülür. Arama motoru sıralaması garanti edilemez; çalışma, sıralamayı belirleyen etkenleri iyileştirmeye odaklanır.',
    ],
    forWhom: [
      'Organik aramadan düzenli ziyaretçi almak isteyen işletmeler',
      'Sitesi taşınmış, yenilenmiş veya trafik kaybetmiş firmalar',
      'Hizmetlerini aranan konularla eşleştirmek isteyen ekipler',
    ],
    scope: [
      'Teknik SEO denetimi: indekslenme, canonical, sitemap, robots.txt, hız ve mobil uyumluluk',
      'Başlık, açıklama ve başlık hiyerarşisi düzenlemeleri',
      'Yapılandırılmış veri (schema.org)',
      'Anahtar kelime araştırması ve içerik planı',
      'İç bağlantı yapısı',
      'Google Search Console ve Bing Webmaster Tools kurulumu, sıralama ve trafik takibi',
    ],
    steps: [
      {
        title: 'Teknik denetim',
        body: 'İndekslenmeyi ve sıralamayı engelleyen teknik sorunlar tespit edilir.',
      },
      { title: 'Düzeltmeler', body: 'Öncelikli teknik sorunlar giderilir.' },
      { title: 'İçerik planı', body: 'Aranan konulara göre sayfa ve içerik planı hazırlanır.' },
      { title: 'Ölçüm', body: 'İndekslenme, görünürlük ve trafik düzenli olarak raporlanır.' },
    ],
    faq: [
      {
        question: 'SEO çalışması ne kadar sürede sonuç verir?',
        answer:
          'Teknik düzeltmelerin etkisi arama motorlarının sayfaları yeniden taramasıyla birkaç hafta içinde görülmeye başlayabilir; içerik ve otorite kaynaklı gelişmeler genellikle daha uzun sürer. Kesin bir süre veya sıralama garanti edilemez.',
      },
      {
        question: 'Teknik SEO denetimi neleri inceler?',
        answer:
          'Teknik SEO denetimi; sayfaların indekslenebilirliğini, canonical ve yönlendirmeleri, sitemap ve robots.txt dosyalarını, sayfa hızını ve Core Web Vitals değerlerini, mobil uyumluluğu, başlık yapısını ve yapılandırılmış veriyi inceler.',
      },
      {
        question: 'SEO ile Google Ads arasındaki fark nedir?',
        answer:
          'Google Ads, arama sonuçlarında ücretli reklam olarak görünmeyi sağlar ve bütçe durduğunda görünürlük de durur. SEO ise organik sonuçlarda görünürlüğü hedefler; tıklama başına ödeme yoktur ancak sonuçlar daha uzun sürede oluşur.',
      },
    ],
    related: ['kurumsal-web-sitesi', 'google-ads', 'landing-page'],
  },

  'kurumsal-web-sitesi': {
    heading: 'Kurumsal web sitesi tasarımı ve geliştirme',
    metaTitle: 'Kurumsal Web Sitesi — Tasarım, Geliştirme ve Yönetim Paneli',
    metaDescription:
      'Şirketinizi doğru anlatan, hızlı ve mobil uyumlu kurumsal web siteleri. İçeriği ekibinizin güncelleyebilmesi için yönetim paneliyle birlikte teslim edilir.',
    intro: [
      'Kurumsal web sitesi, bir şirketin kim olduğunu, ne yaptığını ve kiminle çalıştığını anlatan resmî dijital adresidir.',
      'Nexuva kurumsal web sitelerini hızlı, mobil uyumlu ve arama motorlarına uygun şekilde geliştirir; içeriği kendi ekibinizin güncelleyebilmesi için yönetim paneliyle birlikte teslim eder.',
    ],
    forWhom: [
      'Web sitesi olmayan veya mevcut sitesi şirketi doğru anlatmayan işletmeler',
      'İçeriğini geliştiriciye bağımlı olmadan güncellemek isteyen ekipler',
      'Sitesinin hızını, mobil deneyimini ve arama görünürlüğünü iyileştirmek isteyen firmalar',
    ],
    scope: [
      'Bilgi mimarisi ve sayfa yapısı',
      'Tasarım ve geliştirme',
      'İçerik yönetim paneli',
      'Mobil uyumluluk ve sayfa hızı',
      'Teknik SEO altyapısı: metadata, sitemap, yapılandırılmış veri',
      'İletişim formları ve ölçüm kurulumu',
    ],
    steps: [
      { title: 'Keşif', body: 'Hedef kitle, sayfalar ve içerik ihtiyacı belirlenir.' },
      { title: 'Tasarım', body: 'Sayfa yapısı ve görsel tasarım hazırlanır ve onaylanır.' },
      { title: 'Geliştirme', body: 'Site ve yönetim paneli geliştirilir, test edilir.' },
      { title: 'Yayın ve devir', body: 'Site yayına alınır, ekibinize panel kullanımı aktarılır.' },
    ],
    faq: [
      {
        question: 'Kurumsal web sitesinin içeriğini kendimiz güncelleyebilir miyiz?',
        answer:
          'Evet. Nexuva’nın geliştirdiği kurumsal web siteleri bir yönetim paneliyle teslim edilir; metinler, görseller ve hizmet bilgileri geliştirici gerekmeden bu panelden güncellenebilir.',
      },
      {
        question: 'Web sitesi mobil cihazlara uyumlu mu olacak?',
        answer:
          'Evet. Siteler mobil öncelikli olarak tasarlanır ve telefon, tablet ve masaüstü ekranlarda test edilir.',
      },
      {
        question: 'Web sitesi SEO’ya uygun teslim ediliyor mu?',
        answer:
          'Teknik SEO altyapısı geliştirmenin parçasıdır: sayfa başlıkları ve açıklamaları, canonical adresler, sitemap, robots.txt ve yapılandırılmış veri kurulmuş olarak teslim edilir. Kapsamlı içerik ve SEO çalışması ayrı bir hizmettir.',
      },
    ],
    related: ['seo', 'landing-page', 'marka-danismanligi'],
  },

  'landing-page': {
    heading: 'Landing page tasarımı ve kurulumu',
    metaTitle: 'Landing Page — Kampanyaya Özel, Dönüşüm Odaklı Sayfalar',
    metaDescription:
      'Tek bir kampanya veya ürün için, tek bir eyleme odaklanan landing page tasarımı. Form ve dönüşüm takibi, A/B test altyapısı ile ölçülebilir yayın.',
    intro: [
      'Landing page, reklam veya kampanya trafiğini karşılamak için hazırlanan ve ziyaretçiyi tek bir eyleme (form doldurmak, aramak, satın almak) yönlendiren sayfadır.',
      'Nexuva landing page’leri tek bir kampanya veya ürün için kurar, form ve dönüşüm takibiyle birlikte ölçülebilir biçimde yayına alır.',
    ],
    forWhom: [
      'Reklam trafiğini genel ana sayfaya gönderen işletmeler',
      'Yeni bir ürün veya kampanya başlatan ekipler',
      'Farklı mesajları veriyle karşılaştırmak isteyen pazarlama ekipleri',
    ],
    scope: [
      'Kampanyaya özel sayfa kurgusu ve metin',
      'Tasarım ve geliştirme',
      'Form ve dönüşüm takibi',
      'Reklam platformlarıyla ölçüm entegrasyonu',
      'A/B test altyapısı',
    ],
    steps: [
      { title: 'Hedef', body: 'Sayfanın tek eylemi ve ölçüm yöntemi belirlenir.' },
      { title: 'Kurgu ve tasarım', body: 'Mesaj, bölümler ve görsel tasarım hazırlanır.' },
      { title: 'Yayın', body: 'Sayfa, form ve ölçüm kurulumuyla yayına alınır.' },
      { title: 'Test', body: 'Gerekirse varyasyonlar karşılaştırılır.' },
    ],
    faq: [
      {
        question: 'Landing page ile web sitesi arasındaki fark nedir?',
        answer:
          'Web sitesi bir şirketi bütün olarak anlatır ve birden çok amaca hizmet eder. Landing page ise tek bir kampanya veya ürün için hazırlanır ve ziyaretçiyi tek bir eyleme yönlendirir.',
      },
      {
        question: 'Landing page’in performansı nasıl ölçülür?',
        answer:
          'Form gönderimi, arama veya satın alma gibi hedef eylemler dönüşüm olarak tanımlanır ve analitik ile reklam platformlarına bağlanır. Böylece hangi trafik kaynağının dönüşüm getirdiği görülebilir.',
      },
    ],
    related: ['google-ads', 'meta-ads', 'kurumsal-web-sitesi'],
  },

  'marka-danismanligi': {
    heading: 'Dijital marka danışmanlığı',
    metaTitle: 'Dijital Marka Danışmanlığı — Konumlandırma ve Kanal Stratejisi',
    metaDescription:
      'Markanızın dijitalde nasıl konumlanacağını ve hangi kanalda ne anlatacağını belirleyen danışmanlık. Mevcut durum analiziyle başlayan, uygulanabilir plan.',
    intro: [
      'Dijital marka danışmanlığı; bir markanın dijital kanallarda nasıl konumlanacağını, hangi mesajı hangi kanalda kime anlatacağını belirleme çalışmasıdır.',
      'Nexuva çalışmaya mevcut durumun analiziyle başlar ve sonucu ekibinizin uygulayabileceği bir plana bağlar.',
    ],
    forWhom: [
      'Dijital kanallarda tutarsız görünen veya farklı mesajlar veren markalar',
      'Yeni bir pazara, ürüne veya hedef kitleye yönelen şirketler',
      'Reklam ve içerik çalışmalarına başlamadan önce yön belirlemek isteyen ekipler',
    ],
    scope: [
      'Mevcut dijital varlıkların ve mesajların analizi',
      'Konumlandırma ve temel mesaj',
      'Kanal stratejisi',
      'İçerik yönü',
      'Uygulama planı',
    ],
    steps: [
      { title: 'Analiz', body: 'Mevcut site, sosyal medya ve reklam mesajları incelenir.' },
      { title: 'Konumlandırma', body: 'Markanın kime, neyi, neden farklı sunduğu netleştirilir.' },
      { title: 'Kanal planı', body: 'Hangi kanalda hangi mesajın verileceği belirlenir.' },
      {
        title: 'Uygulama planı',
        body: 'Öncelikler ve sorumluluklarla uygulanabilir bir plan çıkarılır.',
      },
    ],
    faq: [
      {
        question: 'Dijital marka danışmanlığı ne işe yarar?',
        answer:
          'Dijital marka danışmanlığı, markanın web sitesi, sosyal medya ve reklamlarda tutarlı bir kimlikle görünmesini sağlar. Reklam ve içerik çalışmalarının aynı mesajı desteklemesi için yön belirler.',
      },
      {
        question: 'Danışmanlığın çıktısı nedir?',
        answer:
          'Çalışmanın sonunda konumlandırma, temel mesaj, kanal stratejisi ve içerik yönünü içeren, ekibin uygulayabileceği bir plan teslim edilir.',
      },
    ],
    related: ['kurumsal-web-sitesi', 'meta-ads', 'seo'],
  },

  otomasyon: {
    heading: 'İş süreçleri için otomasyon sistemleri',
    metaTitle: 'Otomasyon Sistemleri — Süreç Analizi, Entegrasyon ve Raporlama',
    metaDescription:
      'Tekrar eden işleri yazılıma devreden otomasyon sistemleri: form ve talep akışları, sistemler arası veri aktarımı ve otomatik raporlama.',
    intro: [
      'İş süreci otomasyonu, her seferinde aynı şekilde yapılan işlerin (form ve talep akışları, raporlama, sistemler arası veri aktarımı) yazılım tarafından yürütülmesidir.',
      'Nexuva önce süreci analiz eder ve hangi işin otomatikleşmeye değdiğini sizinle birlikte belirler. Karar gerektiren adımlar insanda kalır.',
    ],
    forWhom: [
      'Aynı veriyi birden çok sisteme elle giren ekipler',
      'Raporlarını her ay elle hazırlayan işletmeler',
      'Talep ve onay süreçleri e-posta ve mesajlaşmaya dağılmış firmalar',
    ],
    scope: [
      'Süreç analizi',
      'Form ve talep akışları',
      'Sistemler arası entegrasyon ve veri aktarımı',
      'Otomatik raporlama',
      'Bildirimler',
    ],
    steps: [
      { title: 'Süreç analizi', body: 'İşin bugün nasıl yürüdüğü adım adım çıkarılır.' },
      { title: 'Önceliklendirme', body: 'Otomatikleşmeye değer adımlar seçilir.' },
      { title: 'Kurulum', body: 'Akışlar ve entegrasyonlar kurulur, test edilir.' },
      { title: 'Devreye alma', body: 'Ekip yeni akışla çalışmaya başlar, ilk dönem izlenir.' },
    ],
    faq: [
      {
        question: 'Hangi işler otomatikleştirilebilir?',
        answer:
          'Her seferinde aynı kurallarla yapılan işler otomasyona uygundur: form verisinin ilgili sisteme aktarılması, talep yönlendirme, düzenli raporların hazırlanması ve bildirimler gibi. Karar gerektiren adımlar insanda kalır.',
      },
      {
        question: 'Kullandığımız yazılımları değiştirmemiz gerekir mi?',
        answer:
          'Genellikle hayır. Otomasyonun amacı mevcut araçların ürettiği bilgiyi tek akışta buluşturmaktır; entegrasyon olanakları kullanılan sistemlere göre belirlenir.',
      },
    ],
    related: ['logiops-entegrasyonu', 'kurumsal-web-sitesi', 'marka-danismanligi'],
  },

  'logiops-entegrasyonu': {
    heading: 'LogiOps entegrasyonu ve kurulumu',
    metaTitle: 'LogiOps Entegrasyonu — Kurulum, Veri Aktarımı ve Ekip Eğitimi',
    metaDescription:
      'Nexuva’nın geliştirdiği LogiOps operasyon platformunun firmanıza kurulumu, mevcut verilerin aktarımı, entegrasyonlar ve ekip eğitimi.',
    intro: [
      'LogiOps, Nexuva tarafından geliştirilen ve dış ticaret ile lojistik operasyonlarının tek bir operasyon dosyası üzerinden yönetilmesini sağlayan bir yazılım ürünüdür.',
      'LogiOps entegrasyonu hizmeti, platformun firmanızın operasyonuna kurulmasını kapsar: yapılandırma, mevcut verinin aktarımı, muhasebe gibi sistemlerle bağlantılar ve ekip eğitimi.',
    ],
    forWhom: [
      'Freight forwarder ve dış ticaret operasyonu yürüten firmalar',
      'Operasyon, saha ve muhasebe ekipleri aynı bilgiyi farklı yerlerde tutan şirketler',
      'LogiOps’u kullanmaya karar vermiş veya değerlendiren ekipler',
    ],
    scope: [
      'Kurulum ve yapılandırma',
      'Mevcut veriyle entegrasyon ve veri aktarımı',
      'Muhasebe sistemleriyle bağlantı (Logo, Uyumsoft)',
      'Ekip eğitimi',
      'İlk dönem desteği',
    ],
    steps: [
      { title: 'Keşif', body: 'Mevcut operasyon akışı birlikte çıkarılır.' },
      { title: 'Yapılandırma', body: 'LogiOps firmanızın akışına göre yapılandırılır.' },
      { title: 'Veri aktarımı', body: 'Mevcut veriler aktarılır, bağlantılar kurulur.' },
      { title: 'Eğitim ve devreye alma', body: 'Ekip eğitilir ve platform kullanıma alınır.' },
    ],
    faq: [
      {
        question: 'LogiOps ile Nexuva arasındaki ilişki nedir?',
        answer:
          'LogiOps, Nexuva tarafından geliştirilen ayrı bir yazılım ürünüdür. Nexuva hem ürünü geliştirir hem de firmalara kurulum, entegrasyon ve eğitim hizmeti verir.',
      },
      {
        question: 'LogiOps entegrasyonu neleri kapsar?',
        answer:
          'Entegrasyon; platformun kurulması ve yapılandırılmasını, mevcut verilerin aktarılmasını, muhasebe sistemleriyle bağlantıların kurulmasını ve ekibin eğitilmesini kapsar.',
      },
    ],
    related: ['otomasyon', 'kurumsal-web-sitesi', 'marka-danismanligi'],
  },
};

/**
 * Questions about Nexuva as a whole, for the home page.
 *
 * Draft for owner review: the first answer is the company definition, which
 * the brief keeps open until it is approved. It follows the wording already
 * published in llms.txt and adds nothing new.
 */
export const HOME_FAQ: FaqItem[] = [
  {
    question: 'Nexuva ne yapar?',
    answer: BRAND_DEFINITION,
  },
  {
    question: 'Nexuva hangi hizmetleri sunar?',
    answer:
      'Nexuva’nın hizmetleri: Google Ads yönetimi, Meta (Facebook ve Instagram) reklam yönetimi, SEO, kurumsal web sitesi, landing page, dijital marka danışmanlığı, otomasyon sistemleri ve LogiOps entegrasyonu.',
  },
  {
    question: 'LogiOps nedir?',
    answer: LOGIOPS_DEFINITION,
  },
  {
    question: 'Nexuva ile çalışmaya nasıl başlanır?',
    answer:
      'İletişim formu veya e-posta ile talep bırakılır. İlk görüşmede ihtiyaç ve hedefler konuşulur, ardından kapsam ve yol haritası paylaşılır.',
  },
];
