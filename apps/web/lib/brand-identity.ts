/**
 * How Nexuva describes itself to machines — one sentence, one source.
 *
 * Search engines and language models build an entity from whatever the site
 * says about itself, and when the home page, the footer, JSON-LD and llms.txt
 * each phrase it differently, the entity comes out blurred: an "agency" here, a
 * "software company" there, LogiOps sometimes a product and sometimes another
 * name for the company. Every machine-facing description reads from here.
 *
 * Status: APPROVED by the owner (21.11.2026), verbatim. Nexuva is the parent
 * brand; LogiOps is a product brand. Change it here and every machine-facing
 * surface follows.
 */
export const BRAND_DEFINITION =
  'Nexuva, işletmelerin dijital büyüme ve operasyonel dönüşüm süreçlerine danışmanlık, ' +
  'yazılım, web teknolojileri, dijital pazarlama ve otomasyon çözümleri sunan bir ' +
  'teknoloji ve danışmanlık şirketidir.';

/**
 * LogiOps: a product brand under Nexuva, never another name for it and never
 * the basis of Nexuva's identity.
 */
export const LOGIOPS_DEFINITION =
  'LogiOps, Nexuva tarafından geliştirilen ayrı bir lojistik ve dış ticaret yazılım ' +
  'ürünüdür. Operasyon bilgisi bir kez girilir ve AWB, manifest, fatura, muhasebe ve ' +
  'doküman süreçlerinde yeniden kullanılır.';
