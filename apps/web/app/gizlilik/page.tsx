import type { Metadata } from 'next';
import { pageMetadata } from '../../lib/seo';
import { PageHero } from '../../components/sections/page-hero';
import { getSiteContent } from '../../lib/content';

/**
 * Gizlilik ve çerez politikası — DRAFT, like the KVKK notice: a structural
 * text for the owner and a lawyer to complete. noindex until then.
 */
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: '/gizlilik',
    title: 'Gizlilik ve Çerez Politikası',
    description: 'Nexuva internet sitesinde çerezlerin ve ölçüm araçlarının nasıl kullanıldığı.',
    noIndex: true,
  });
}

export default async function PrivacyPage() {
  const content = await getSiteContent();
  const email = content.brand?.email;

  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Gizlilik ve Çerez Politikası', href: '/gizlilik' }]}
        badge="Gizlilik"
        title="Gizlilik ve Çerez Politikası"
      />
      <section className="section pt-0">
        <div className="container-x">
          <div className="prose-measure space-y-6 text-base">
            <p
              role="note"
              className="border-overlay/15 bg-card text-fg rounded-[var(--r-md)] border p-4 text-sm"
            >
              Bu metin taslaktır ve hukuki onay beklemektedir.
            </p>

            <h2 className="display-3 text-fg">Çerezler ve ölçüm</h2>
            <p>
              Site, ziyaretlerin nasıl kullanıldığını anlamak ve reklam çalışmalarının sonucunu
              ölçmek için sayfa görüntüleme ve tıklama gibi kullanım verilerini toplayabilir.
              Reklam ve analiz araçları etkinleştirildiğinde bu araçların kendi çerezleri de
              kullanılabilir.
            </p>

            <h2 className="display-3 text-fg">Formlarda paylaştığınız bilgiler</h2>
            <p>
              İletişim ve başvuru formlarına yazdığınız bilgiler yalnızca talebinizi yanıtlamak
              için kullanılır. Ayrıntılar için{' '}
              <a className="underline underline-offset-2" href="/kvkk/">
                KVKK Aydınlatma Metni
              </a>
              ’ni inceleyebilirsiniz.
            </p>

            <h2 className="display-3 text-fg">Tarayıcı ayarları</h2>
            <p>
              Çerezleri tarayıcı ayarlarınızdan silebilir veya engelleyebilirsiniz. Bu durumda
              sitenin bazı özellikleri beklendiği gibi çalışmayabilir.
            </p>

            <h2 className="display-3 text-fg">İletişim</h2>
            <p>
              Gizlilikle ilgili sorularınız için
              {email ? (
                <>
                  {' '}
                  <a className="underline underline-offset-2" href={`mailto:${email}`}>
                    {email}
                  </a>{' '}
                  adresine
                </>
              ) : (
                ' bize'
              )}{' '}
              yazabilirsiniz.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
