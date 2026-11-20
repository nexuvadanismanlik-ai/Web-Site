import { absoluteUrl } from '../../lib/origin';
import { serializeJsonLd } from '../../lib/seo';

/**
 * Structured data for the LogiOps page.
 *
 * Two audiences, one markup. Search engines use schema.org to decide what a
 * page is about and whether it deserves a rich result. Language models use the
 * same thing for a different reason: when a model is asked "which freight
 * forwarder software handles AWB and CMR", it answers from pages whose meaning
 * it could extract with confidence — and JSON-LD is meaning already extracted.
 * A page that only expresses itself through prose is a page the model has to
 * guess about, and it will prefer one that did not make it guess.
 *
 * The FAQ is no longer marked up here: it is rendered on the page by <Faq>,
 * which emits its own FAQPage from the same list (components/logiops/faq-data).
 *
 * Everything asserted here is checkable against the page. Marking up a claim
 * the page does not make is how a site earns a manual penalty, and marking up
 * a feature the product does not have is the same lie in a machine-readable
 * format.
 */
export function LogiOpsSchema({ title, description }: { title: string; description: string }) {
  const url = absoluteUrl('/logiops');
  const home = absoluteUrl('/');
  if (!url) return null;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': `${url}#software`,
        name: 'LogiOps',
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Freight Forwarding & Trade Operations Software',
        operatingSystem: 'Web',
        url,
        description,
        inLanguage: 'tr-TR',
        publisher: { '@id': `${home}#organization` },
        creator: { '@id': `${home}#organization` },
        // Only what exists today. The vision section of the page is
        // deliberately absent from this list.
        featureList: [
          'Operasyon dosyası yönetimi',
          'Air Waybill (AWB) ve Master AWB oluşturma',
          'Bill of Lading (BL) yönetimi',
          'CMR ve manifest belgeleri',
          'Operasyonla ilişkili mail yönetimi',
          'Operasyon timeline’ı',
          'Doküman yönetimi',
          'Satış ve alış faturası, taslak fatura',
          'Ekipler arası talep sistemi',
          'Data Center — havayolu, havalimanı, armatör, liman ve prefix verileri',
          'Muhasebe sistemleri ile entegrasyon',
        ],
        audience: {
          '@type': 'BusinessAudience',
          audienceType:
            'Freight forwarder firmaları, lojistik firmaları, ithalat ve ihracat operasyonu yürüten şirketler',
        },
      },
      {
        '@type': 'WebPage',
        '@id': url,
        url,
        name: title,
        description,
        inLanguage: 'tr-TR',
        isPartOf: { '@id': `${home}#website` },
        about: { '@id': `${url}#software` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  );
}
