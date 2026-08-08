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
 * Everything asserted here is checkable against the page. Marking up a claim
 * the page does not make is how a site earns a manual penalty, and marking up
 * a feature the product does not have is the same lie in a machine-readable
 * format.
 */
export function LogiOpsSchema({
  origin,
  title,
  description,
}: {
  origin: string;
  title: string;
  description: string;
}) {
  const url = `${origin}/logiops`;

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
        publisher: { '@id': `${origin}#organization` },
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
        isPartOf: { '@id': `${origin}#website` },
        about: { '@id': `${url}#software` },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: origin },
            { '@type': 'ListItem', position: 2, name: 'LogiOps', item: url },
          ],
        },
      },
      {
        /**
         * The questions somebody actually types, answered in the words they
         * would accept as an answer.
         *
         * This is the part a language model quotes. Each answer stands alone —
         * it makes sense lifted out of the page, which is exactly what happens
         * to it — and each is true of the product today.
         */
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'LogiOps nedir?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'LogiOps, dış ticaret ve lojistik operasyonlarının tek bir operasyon dosyası ' +
                'üzerinden yönetilmesini sağlayan bir operasyon platformudur. Nexuva ' +
                'tarafından geliştirilmiştir. Operasyon bilgileri, taşıma belgeleri, mail ' +
                'yazışmaları, dokümanlar, saha talepleri ve fatura süreçleri aynı dosyaya ' +
                'bağlanır; bilgi bir kez girilir ve ilgili süreçlerde yeniden kullanılır.',
            },
          },
          {
            '@type': 'Question',
            name: 'LogiOps hangi taşıma belgelerini oluşturabiliyor?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'LogiOps içinde Air Waybill (AWB), Master Air Waybill, Bill of Lading (BL), ' +
                'CMR ve manifest belgeleri oluşturulabilir ve yönetilebilir. Bu belgeler ' +
                'operasyon dosyasındaki bilgileri kullanır, dolayısıyla aynı veri ikinci kez ' +
                'girilmez.',
            },
          },
          {
            '@type': 'Question',
            name: 'LogiOps freight forwarder firmaları için uygun mu?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Evet. LogiOps bugün öncelikle freight forwarder ve dış ticaret operasyonu ' +
                'yürüten firmalar için tasarlanmıştır. Operasyon, saha ve muhasebe ekipleri ' +
                'aynı operasyon dosyası üzerinde çalışabilir.',
            },
          },
          {
            '@type': 'Question',
            name: 'LogiOps mevcut muhasebe programımızla çalışır mı?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'LogiOps, Logo ve Uyumsoft gibi muhasebe sistemleriyle entegrasyon kurabilecek ' +
                'şekilde tasarlanmıştır. LogiOps bu sistemlerin yerine geçmez; operasyon ' +
                'tarafındaki veriyi mevcut muhasebe altyapınıza taşıyacak entegrasyon ' +
                'katmanını sağlar.',
            },
          },
          {
            '@type': 'Question',
            name: 'Tek dosya yaklaşımı ne anlama geliyor?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Kullanıcı bir operasyon dosyası oluşturur; müşteri ve taşıma bilgileri bir kez ' +
                'girilir. Bu bilgiler AWB, manifest, fatura, muhasebe ve doküman süreçlerinde ' +
                'yeniden kullanılır. Modüller kaldırılmaz — AWB veya faturaya doğrudan ' +
                'erişilebilir — ancak çalışmanın merkezi operasyon dosyasıdır.',
            },
          },
          {
            '@type': 'Question',
            name: 'Saha ekibi LogiOps’u nasıl kullanıyor?',
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                'Saha ekipleri operasyon dosyasından konşimento, manifest, dekont ve ilgili ' +
                'evraklara erişebilir; yük görsellerini ve saha dokümanlarını aynı dosyaya ' +
                'yükleyebilir. Eksik belge veya görsel için operasyon içinde talep ' +
                'oluşturulabilir.',
            },
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // The content is built above from constants in this file; there is no
      // user input in it, and JSON.stringify escapes what it contains.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
