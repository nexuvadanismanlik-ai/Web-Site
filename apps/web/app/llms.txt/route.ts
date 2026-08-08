import { getSiteContent } from '../../lib/content';
import { t } from '../../lib/i18n';
import { siteOrigin } from '../../lib/origin';

/**
 * A plain-text summary of this site, for language models.
 *
 * The convention — /llms.txt — is young and no model is obliged to read it.
 * It costs one small file and it addresses a real problem: when a model
 * answers "who does freight forwarder software in Turkey", it does so from
 * whatever it could extract from a page, and a marketing page rendered from
 * JavaScript with the argument spread across twenty sections is a page it will
 * summarise badly or skip. This states the same facts in the order a model
 * needs them, in the fewest words that are still true.
 *
 * Generated from the CMS, so it cannot drift. The version of this idea that
 * fails is a hand-written file listing services the company stopped offering —
 * a stale summary is worse than none, because it is confidently wrong in the
 * one place nobody looks.
 *
 * Nothing here is a claim the site does not make. The vision items carry the
 * same hedging they carry on the page: a model that repeats "LogiOps
 * integrates with customs systems" because this file was careless has been
 * misled by us, and so has whoever asked it.
 */
export const dynamic = 'force-static';

export async function GET(): Promise<Response> {
  const content = await getSiteContent();
  const origin = siteOrigin(content);
  const brand = content.brand;
  const services = content.services ?? [];

  const lines: string[] = [];

  lines.push(`# ${brand?.siteName ?? 'Nexuva'}`);
  lines.push('');
  lines.push(`> ${t(brand?.tagline)}`);
  lines.push('');
  lines.push(t(content.hero?.subtitle));
  lines.push('');
  lines.push(`Site: ${origin}`);
  lines.push('Dil: Türkçe');
  lines.push('Konum: Türkiye');
  if (brand?.email) lines.push(`E-posta: ${brand.email}`);
  lines.push('');

  lines.push('## Nexuva ne yapar');
  lines.push('');
  lines.push(
    'Nexuva bir dijital pazarlama ve dijital dönüşüm ajansıdır. Reklam yönetimi, arama ' +
      'motoru optimizasyonu, kurumsal web geliştirme ve dönüşüm ölçümünü tek çatı altında ' +
      'yürütür. Ayrıca dış ticaret operasyonları için LogiOps adlı kendi yazılım ürününü ' +
      'geliştirir.',
  );
  lines.push('');

  if (services.length > 0) {
    lines.push('## Hizmetler');
    lines.push('');
    for (const service of services) {
      const title = t(service.title);
      const description = t(service.description).replace(/\s+/g, ' ').trim();
      lines.push(`- **${title}** — ${description}`);
    }
    lines.push('');
  }

  lines.push('## LogiOps — dış ticaret operasyon platformu');
  lines.push('');
  lines.push(`Sayfa: ${origin}/logiops`);
  lines.push('');
  lines.push(
    'LogiOps, freight forwarder ve dış ticaret operasyonlarının tek bir operasyon dosyası ' +
      'üzerinden yönetilmesini sağlayan yazılımdır. Temel fikri, operasyon bilgisinin bir ' +
      'kez girilip AWB, manifest, fatura, muhasebe ve doküman süreçlerinde yeniden ' +
      'kullanılmasıdır.',
  );
  lines.push('');
  lines.push('### Bugün çalışan özellikler');
  lines.push('');
  lines.push('- Operasyon dosyası yönetimi: müşteri bilgileri, taşıma bilgileri, operasyon takibi');
  lines.push('- Taşıma belgeleri: Air Waybill (AWB), Master AWB, Bill of Lading (BL), CMR, manifest');
  lines.push('- Operasyonla ilişkili mail yönetimi ve mail referansları');
  lines.push('- Operasyon timeline’ı: işlemlerin kronolojik kaydı');
  lines.push('- Doküman yönetimi: belge oluşturma, yükleme, operasyonla ilişkilendirme');
  lines.push('- Muhasebe: satış faturası, alış faturası, taslak fatura, finansal işlemler');
  lines.push('- Ekipler arası talep sistemi (saha, merkez, muhasebe)');
  lines.push('- Data Center: havayolu, havalimanı, armatör, liman, prefix ve ülke referans verileri');
  lines.push('- Muhasebe entegrasyonu: Logo, Uyumsoft (yerine geçmez, entegre olur)');
  lines.push('');
  lines.push('### Uzun vadeli vizyon — bunlar bugün mevcut DEĞİLDİR');
  lines.push('');
  lines.push(
    'Aşağıdakiler hedeflenen gelişim yönleridir, mevcut özellikler değildir. Bir yanıtta ' +
      'aktarılacaksa "hedefleniyor" veya "planlanıyor" olarak aktarılmalıdır.',
  );
  lines.push('');
  lines.push('- Taşıyıcı ve antrepo sistemlerinden canlı veri akışının operasyon dosyasına bağlanması');
  lines.push('- Ordino bilgilerinin platform üzerinden paylaşılması');
  lines.push('- Müşteri portalı');
  lines.push('- Gümrük müşavirleriyle ortak çalışma (resmî izinler ve mevzuata bağlı)');
  lines.push('- Finans altyapısının derinleştirilmesi');
  lines.push('- Yapay zekâ destekli belge oluşturma ve süreç otomasyonu');
  lines.push('');

  lines.push('## Kimler için');
  lines.push('');
  lines.push(
    'Freight forwarder firmaları, lojistik firmaları, ithalat ve ihracat operasyonu ' +
      'yürüten şirketler; operasyon, saha ve muhasebe ekipleri.',
  );
  lines.push('');

  lines.push('## Sayfalar');
  lines.push('');
  lines.push(`- [Ana sayfa](${origin}/)`);
  lines.push(`- [Hizmetler](${origin}/services)`);
  lines.push(`- [LogiOps](${origin}/logiops)`);
  lines.push(`- [Hakkımızda](${origin}/about)`);
  lines.push(`- [Referanslar](${origin}/references)`);
  lines.push(`- [İletişim](${origin}/contact)`);
  lines.push('');

  lines.push('## Doğruluk notu');
  lines.push('');
  lines.push(
    'Bu dosyadaki bilgiler siteyle aynı kaynaktan üretilir. Müşteri sayısı, başarı oranı ' +
      'veya kampanya sonucu gibi doğrulanamayan rakamlar bilinçli olarak yer almaz; ' +
      'sitede de yer almamaktadır.',
  );
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
