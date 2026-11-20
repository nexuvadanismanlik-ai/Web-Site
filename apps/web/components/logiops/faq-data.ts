import type { FaqItem } from '../faq';

/**
 * Questions about LogiOps, shown on the product page and marked up from the
 * same list. FAQ structured data is only allowed for questions a visitor can
 * actually read on the page; keeping one source makes the two impossible to
 * separate.
 */
export const LOGIOPS_FAQ: FaqItem[] = [
  {
    question: 'LogiOps nedir?',
    answer:
      'LogiOps, dış ticaret ve lojistik operasyonlarının tek bir operasyon dosyası üzerinden yönetilmesini sağlayan bir operasyon platformudur. Nexuva tarafından geliştirilmiştir. Operasyon bilgileri, taşıma belgeleri, mail yazışmaları, dokümanlar, saha talepleri ve fatura süreçleri aynı dosyaya bağlanır; bilgi bir kez girilir ve ilgili süreçlerde yeniden kullanılır.',
  },
  {
    question: 'LogiOps hangi taşıma belgelerini oluşturabiliyor?',
    answer:
      'LogiOps içinde Air Waybill (AWB), Master Air Waybill, Bill of Lading (BL), CMR ve manifest belgeleri oluşturulabilir ve yönetilebilir. Bu belgeler operasyon dosyasındaki bilgileri kullanır, dolayısıyla aynı veri ikinci kez girilmez.',
  },
  {
    question: 'LogiOps freight forwarder firmaları için uygun mu?',
    answer:
      'Evet. LogiOps bugün öncelikle freight forwarder ve dış ticaret operasyonu yürüten firmalar için tasarlanmıştır. Operasyon, saha ve muhasebe ekipleri aynı operasyon dosyası üzerinde çalışabilir.',
  },
  {
    question: 'LogiOps mevcut muhasebe programımızla çalışır mı?',
    answer:
      'LogiOps, Logo ve Uyumsoft gibi muhasebe sistemleriyle entegrasyon kurabilecek şekilde tasarlanmıştır. LogiOps bu sistemlerin yerine geçmez; operasyon tarafındaki veriyi mevcut muhasebe altyapınıza taşıyacak entegrasyon katmanını sağlar.',
  },
  {
    question: 'Tek dosya yaklaşımı ne anlama geliyor?',
    answer:
      'Kullanıcı bir operasyon dosyası oluşturur; müşteri ve taşıma bilgileri bir kez girilir. Bu bilgiler AWB, manifest, fatura, muhasebe ve doküman süreçlerinde yeniden kullanılır. Modüller kaldırılmaz — AWB veya faturaya doğrudan erişilebilir — ancak çalışmanın merkezi operasyon dosyasıdır.',
  },
  {
    question: 'Saha ekibi LogiOps’u nasıl kullanıyor?',
    answer:
      'Saha ekipleri operasyon dosyasından konşimento, manifest, dekont ve ilgili evraklara erişebilir; yük görsellerini ve saha dokümanlarını aynı dosyaya yükleyebilir. Eksik belge veya görsel için operasyon içinde talep oluşturulabilir.',
  },
];
