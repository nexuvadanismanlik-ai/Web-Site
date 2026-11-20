/**
 * How Nexuva describes itself to machines — one sentence, one source.
 *
 * Search engines and language models build an entity from whatever the site
 * says about itself, and when the home page, the footer, JSON-LD and llms.txt
 * each phrase it differently, the entity comes out blurred: an "agency" here, a
 * "software company" there, LogiOps sometimes a product and sometimes another
 * name for the company. Every machine-facing description reads from here.
 *
 * Status: PENDING OWNER APPROVAL. This is the wording already published in
 * llms.txt, unchanged in substance. The brief keeps the definitive brand
 * definition open until it is approved; change it here and every surface
 * follows.
 */
export const BRAND_DEFINITION =
  'Nexuva; dijital pazarlama, reklam yönetimi, SEO, kurumsal web geliştirme ve iş süreci ' +
  'otomasyonu hizmetleri veren bir dijital dönüşüm şirketidir. Ayrıca dış ticaret ' +
  'operasyonları için LogiOps adlı yazılım ürününü geliştirir.';

/** LogiOps, always as a product Nexuva makes — never as another name for it. */
export const LOGIOPS_DEFINITION =
  'LogiOps, Nexuva tarafından geliştirilen bir dış ticaret ve lojistik operasyon ' +
  'platformudur. Operasyon bilgisi bir kez girilir ve AWB, manifest, fatura, muhasebe ' +
  've doküman süreçlerinde yeniden kullanılır.';
