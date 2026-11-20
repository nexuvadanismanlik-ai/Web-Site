import type { Metadata } from 'next';
import { getSiteContent } from '../../lib/content';
import { pageMetadata } from '../../lib/seo';
import { PageHero } from '../../components/sections/page-hero';

/**
 * KVKK aydınlatma metni — DRAFT.
 *
 * The forms collect personal data and ask the visitor to accept processing,
 * but there was no notice to link to. This page gives the forms that link.
 *
 * It is a structural draft, not legal text: the controller's title, address,
 * retention periods and transfer details are placeholders the owner must fill
 * in, and a lawyer should review the whole before it is relied on. Until then
 * the page is noindex and says, at the top, that it is a draft.
 */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: '/kvkk',
    title: 'KVKK Aydınlatma Metni',
    description:
      'Nexuva internet sitesindeki iletişim ve başvuru formları aracılığıyla işlenen kişisel veriler hakkında aydınlatma metni.',
    noIndex: true,
  });
}

export default async function KvkkPage() {
  const content = await getSiteContent();
  const email = content.brand?.email;

  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'KVKK Aydınlatma Metni', href: '/kvkk' }]}
        badge="Kişisel veriler"
        title="KVKK Aydınlatma Metni"
      />
      <section className="section pt-0">
        <div className="container-x">
          <div className="prose-measure space-y-6 text-base">
            <p
              role="note"
              className="border-overlay/15 bg-card text-fg rounded-[var(--r-md)] border p-4 text-sm"
            >
              Bu metin taslaktır ve hukuki onay beklemektedir. Köşeli parantez içindeki alanlar veri
              sorumlusu tarafından doldurulacaktır.
            </p>

            <h2 className="display-3 text-fg">1. Veri sorumlusu</h2>
            <p>
              6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca kişisel verileriniz,
              veri sorumlusu sıfatıyla [Veri sorumlusunun ticari unvanı] ([adres]) tarafından
              aşağıda açıklanan kapsamda işlenmektedir.
            </p>

            <h2 className="display-3 text-fg">2. İşlenen kişisel veriler</h2>
            <p>
              İletişim ve başvuru formları aracılığıyla paylaştığınız ad soyad, e-posta adresi,
              telefon numarası, firma adı, ilgilendiğiniz hizmet, bütçe aralığı ve mesaj içeriği;
              ayrıca formun gönderildiği sayfa ve kampanya bilgisi (UTM parametreleri) işlenir.
            </p>

            <h2 className="display-3 text-fg">3. İşleme amaçları</h2>
            <p>
              Talebinizin değerlendirilmesi, sizinle iletişime geçilmesi, teklif ve hizmet
              süreçlerinin yürütülmesi ve talebin hangi kanaldan geldiğinin ölçülmesi.
            </p>

            <h2 className="display-3 text-fg">4. Hukuki sebep</h2>
            <p>[Hukuki sebepler hukuk danışmanı tarafından belirlenecektir.]</p>

            <h2 className="display-3 text-fg">5. Aktarım</h2>
            <p>
              Veriler, hizmetin sağlanması için kullanılan altyapı sağlayıcılarında (barındırma,
              veritabanı ve e-posta gönderim hizmetleri) saklanır ve işlenir. [Aktarılan taraflar ve
              yurt dışı aktarım bilgileri eklenecektir.]
            </p>

            <h2 className="display-3 text-fg">6. Saklama süresi</h2>
            <p>[Saklama süreleri belirlenecektir.]</p>

            <h2 className="display-3 text-fg">7. Haklarınız</h2>
            <p>
              KVKK’nın 11. maddesi kapsamındaki haklarınıza ilişkin taleplerinizi
              {email ? (
                <>
                  {' '}
                  <a className="underline underline-offset-2" href={`mailto:${email}`}>
                    {email}
                  </a>{' '}
                  adresine
                </>
              ) : (
                ' [başvuru kanalı] üzerinden'
              )}{' '}
              iletebilirsiniz.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
