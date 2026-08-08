import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getSiteContent } from '../../lib/content';
import { t } from '../../lib/i18n';
import { siteOrigin } from '../../lib/origin';
import { Reveal, Stagger, StaggerItem } from '../../components/motion';
import {
  ConvergeDiagram,
  FlowDiagram,
  GrowthLadder,
  OperationFileOrbit,
  ScatteredVsFile,
} from '../../components/logiops/diagrams';
import { LogiOpsSchema } from '../../components/logiops/schema';

/**
 * LogiOps — the product page.
 *
 * Structured as an argument, not a feature list: the problem in the reader's
 * own week, then the single idea the product is built on, then what it does
 * today, then where it is going. Somebody scrolling should be able to answer
 * three questions — what am I buying, what does it save me, what happens next —
 * and the third must never be dressed up as the first.
 *
 * That separation is enforced visually and not only in the words. Everything
 * under "Bugün Hazır" exists; everything under "Uzun Vadeli Vizyon" is marked,
 * on a different ground, and written in the language of intent. A customer who
 * buys a promised feature and does not find it has been misled by the page,
 * whatever anybody meant by it.
 *
 * The copy lives here rather than in the CMS, unlike every other page on this
 * site, and that is a deliberate exception: this text is a set of careful
 * claims about what software does and does not do today, and the line between
 * the two is not something to leave to whoever edits a field next. The
 * headline, the calls to action and the closing words still come from the
 * panel — see the `logiops` section.
 */

const TITLE = 'LogiOps | Dış Ticaret ve Lojistik Operasyon Yönetim Platformu';
const DESCRIPTION =
  'LogiOps; operasyon, AWB, BL, CMR, doküman, mail, saha ve finans süreçlerini tek ' +
  'operasyon dosyasında birleştiren dış ticaret operasyon platformudur.';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  const origin = siteOrigin(content);
  const url = `${origin}/logiops`;

  return {
    title: TITLE,
    description: DESCRIPTION,
    keywords: [
      'lojistik yazılımı',
      'dış ticaret yazılımı',
      'freight forwarder yazılımı',
      'freight forwarding software',
      'lojistik operasyon yönetimi',
      'dış ticaret operasyon yönetimi',
      'operasyon takip sistemi',
      'AWB yazılımı',
      'BL yönetimi',
      'CMR',
      'lojistik ERP',
      'dış ticaret ERP',
      'lojistik otomasyon',
      'operasyon yönetim sistemi',
      // The air-cargo side, named the way the people who buy it name it. An
      // IATA agent searching for a system does not type "lojistik yazılımı".
      'IATA acente yazılımı',
      'IATA kargo acentesi yazılımı',
      'hava kargo operasyon yazılımı',
      'hava kargo yazılımı',
      'master AWB takip',
      'house AWB takip',
      'konşimento takip sistemi',
      'nakliye komisyoncusu yazılımı',
    ],
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: TITLE,
      description: DESCRIPTION,
      siteName: content.brand?.siteName ?? 'Nexuva',
      // Set here on purpose. A child route's `openGraph` replaces the parent's
      // rather than merging into it, so leaving this out did not inherit the
      // site card — it left the product page, the one most likely to be shared
      // into a group of forwarders, with no share image at all.
      images: [{ url: '/og.png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESCRIPTION,
      images: ['/og.png'],
    },
  };
}

/** A section heading with the house eyebrow and rule. */
function Heading({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className={`display-2 text-fg ${eyebrow ? 'mt-5' : ''}`}>{title}</h2>
      {lede && <p className="prose-measure mt-5 text-base sm:text-lg">{lede}</p>}
    </div>
  );
}

/** What exists today. Plain cards on the page's own ground. */
const MVP = [
  {
    title: 'Operasyon Yönetimi',
    body: 'Operasyon dosyaları, müşteri ve taşıma bilgileri, operasyon süreçleri ve takibi.',
  },
  {
    title: 'Mail Yönetimi',
    body: 'Operasyonla ilişkili mail yönetimi ve mail referansları — yazışma dosyanın içinde kalır.',
  },
  {
    title: 'Timeline',
    body: 'Operasyonda gerçekleşen işlemlerin kronolojik olarak izlenmesi.',
  },
  {
    title: 'Doküman Yönetimi',
    body: 'Operasyonla ilişkili belgelerin oluşturulması, yüklenmesi ve yönetilmesi.',
  },
  {
    title: 'Taşıma Belgeleri',
    body: 'Air Waybill, Master Air Waybill, Bill of Lading, CMR ve manifest belgelerinin sistem içinde oluşturulması.',
  },
  {
    title: 'Muhasebe',
    body: 'Operasyon dosyasından satış faturası, alış faturası, taslak fatura ve finansal işlemler.',
  },
  {
    title: 'Talep Sistemi',
    body: 'Ekipler operasyon içinde birbirinden talep oluşturabilir; talepler operasyonla birlikte izlenir.',
  },
  {
    title: 'Data Center',
    body: 'Havayolları, havalimanları, armatörler, limanlar ve prefixler gibi referans verilerinin merkezî yönetimi.',
  },
];

/** Where the platform is going. Marked, and written as intent. */
const VISION = [
  {
    title: 'Canlı Entegrasyon',
    body:
      'Dış sistemlerden gelen bilginin doğrudan ilgili operasyon dosyasına bağlanması ' +
      'hedefleniyor — uçuş durumu, varış bilgisi, ordino durumu gibi.',
  },
  {
    title: 'Ordino Bilgileri',
    body:
      'Havayolu ve taşıyıcı tarafındaki güncel ücret, hesap ve servis bilgilerinin ' +
      'platform üzerinden paylaşılabilmesi planlanıyor.',
  },
  {
    title: 'Antrepo Entegrasyonu',
    body:
      'Antrepo ve benzeri operasyon noktalarından gelen ölçüm ve tartım verilerinin ' +
      'ilgili dosyaya otomatik işlenmesi hedefleniyor.',
  },
  {
    title: 'Müşteri Portalı',
    body:
      'Lojistik firmasının müşterilerinin operasyonlarını takip edebileceği, talep ' +
      'oluşturabileceği ayrı bir portal planlanıyor.',
  },
  {
    title: 'Gümrük',
    body:
      'Lojistik firmaları ile gümrük müşavirlerinin aynı platformda çalışabilmesi; resmî ' +
      'izinler ve mevzuat doğrultusunda entegrasyonlar hedefleniyor.',
  },
  {
    title: 'Genişleyen Finans',
    body:
      'Bugün Logo ve Uyumsoft gibi sistemlerle entegrasyon var. İleride mevzuat ve gerekli ' +
      'izinler doğrultusunda finans altyapısının derinleştirilmesi hedefleniyor.',
  },
];

export default async function LogiOpsPage() {
  const content = await getSiteContent();
  const logiops = content.logiops ?? ({} as NonNullable<typeof content.logiops>);
  const origin = siteOrigin(content);

  // Panel-managed where it should be: the promise at the top, the words at the
  // bottom, and both calls to action.
  const lead = t(logiops.titleLead) || 'Dış ticaret operasyonlarınızı';
  const highlight = t(logiops.titleHighlight) || 'tek dosyada yönetin';
  const subtitle =
    t(logiops.subtitle) ||
    'LogiOps; operasyon, doküman, iletişim, saha ve finans süreçlerini aynı operasyon ' +
      'dosyası üzerinde birleştiren dış ticaret operasyon platformudur.';

  return (
    <>
      <LogiOpsSchema origin={origin} title={TITLE} description={DESCRIPTION} />

      {/* ── 01 · Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              'radial-gradient(60% 45% at 50% 0%, color-mix(in srgb, var(--brand) 12%, transparent) 0%, transparent 70%)',
          }}
        />
        <div className="container-x">
          <div className="max-w-3xl">
            <Reveal>
              <span className="eyebrow" data-edit="logiops.badge">
                {t(logiops.badge) || 'Nexuva Ürünü'}
              </span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="display-1 mt-7 text-fg">
                <span data-edit="logiops.titleLead">{lead}</span>{' '}
                <span
                  className="italic"
                  style={{ color: 'var(--gold)' }}
                  data-edit="logiops.titleHighlight"
                >
                  {highlight}
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="prose-measure mt-7 text-base sm:text-lg" data-edit="logiops.subtitle">
                {subtitle}
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="#bugun"
                  className="btn-primary"
                  data-cta="logiops-explore"
                  data-edit="logiops.primaryCta.label"
                >
                  {t(logiops.primaryCta?.label) || 'LogiOps’u Keşfedin'}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href={logiops.secondaryCta?.href || '/contact'}
                  className="btn-ghost"
                  data-cta="logiops-demo"
                  data-edit="logiops.secondaryCta.label"
                >
                  {t(logiops.secondaryCta?.label) || 'Demo Talep Et'}
                  <ArrowUpRight className="h-4 w-4 opacity-60" />
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.24}>
            <div className="mt-14">
              {logiops.image ? (
                <div className="overflow-hidden rounded-[var(--r-lg)] border border-overlay/15 bg-card shadow-[var(--shadow-float)]">
                  <img
                    src={logiops.image}
                    alt={logiops.imageAlt ?? 'LogiOps operasyon ekranı'}
                    className="block h-auto w-full"
                    width={1600}
                    height={900}
                  />
                </div>
              ) : (
                /* No invented screenshot. The brief is explicit: where a real
                   interface would go and there is none, show the structure
                   instead. A mocked-up UI would be a picture of software that
                   does not look like this. */
                <OperationFileOrbit />
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 02 · Problem ───────────────────────────────────────────────── */}
      <section className="section border-t border-overlay/8">
        <div className="container-x">
          <Reveal>
            <Heading
              eyebrow="Problem"
              title="Operasyon neden hâlâ dağınık?"
              lede="Bir dosya yedi ayrı yerde yaşıyor. Hiçbiri yanlış çalışmıyor — sadece hiçbiri diğerini bilmiyor."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-12 rounded-[var(--r-lg)] border border-overlay/10 bg-card p-6 sm:p-10">
              <ScatteredVsFile />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 03 · Core concept ──────────────────────────────────────────── */}
      <section className="section border-t border-overlay/8">
        <div className="container-x">
          <Reveal>
            <Heading
              eyebrow="Temel fikir"
              title="Tek dosya."
              lede="Bilgiyi bir kez oluşturun, operasyonunuz boyunca kullanın. Modüller kaldırılmıyor — AWB’ye, faturaya, dokümana doğrudan erişmeye devam edersiniz. Değişen şey, çalışmanın merkezinin operasyon dosyası olması."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-12">
              <OperationFileOrbit />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 04 · How it works ──────────────────────────────────────────── */}
      <section className="section border-t border-overlay/8">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <Reveal>
              <Heading
                eyebrow="Nasıl çalışır"
                title="Beş adım, tek dosya."
                lede="Her adımda girilen bilgi bir sonrakinde hazır bekler. Aynı veriyi ikinci kez yazmazsınız."
              />
            </Reveal>
            <Reveal delay={0.1}>
              <FlowDiagram
                steps={[
                  { title: 'Operasyonu oluştur', body: 'Müşteri ve taşıma bilgileri bir kez girilir.' },
                  { title: 'Süreci yönet', body: 'Operasyon, saha ve muhasebe aynı dosya üzerinde çalışır.' },
                  { title: 'Belgeleri oluştur', body: 'AWB, Master AWB, BL, CMR ve manifest — dosyadaki veriyle.' },
                  { title: 'Finansal süreci yönet', body: 'Satış ve alış faturaları, taslak fatura, finansal işlemler.' },
                  { title: 'Operasyonu takip et', body: 'Timeline üzerinden tüm sürecin geçmişi.' },
                ]}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 05–10 · What the file holds ────────────────────────────────── */}
      <section className="section border-t border-overlay/8">
        <div className="container-x">
          <Reveal>
            <Heading
              eyebrow="Dosyanın içinde"
              title="Operasyonun yaşayan merkezi."
              lede="Operasyon ilerledikçe dosya zenginleşir: belge oluşur, mail düşer, saha talep açar, fatura kesilir, her olay timeline’a yazılır."
            />
          </Reveal>

          <Stagger className="mt-12 grid gap-6 sm:grid-cols-2" gap={0.07}>
            {[
              {
                title: 'Mail artık operasyonun dışında değil',
                body: 'Operasyonla ilgili yazışma, referansıyla birlikte dosyanın içinde kalır. Kimin ne yazdığını bulmak için gelen kutusunda arama yapmazsınız.',
              },
              {
                title: 'Belgeler ayrı sistemlerde yaşamasın',
                body: 'AWB, BL, CMR, manifest, dekont ve yük görselleri aynı operasyonla ilişkilendirilir.',
              },
              {
                title: 'Muhasebe operasyonun içinde çalışsın',
                body: 'Operasyon verisi muhasebeye taşınmaz; fatura süreci dosyadaki bilgiyi yeniden kullanır.',
              },
              {
                title: 'Merkez ve saha aynı operasyonu görsün',
                body: 'Saha ekibi evrak, görsel, talep ve görevleri aynı dosya üzerinden yönetir.',
              },
              {
                title: 'Talepler kayıt altında',
                body: 'Saha–merkez, merkez–muhasebe arasındaki talepler operasyonla ilişkili olarak izlenir. Amaç, dağınık kanallardaki istekleri görünür kılmak.',
              },
              {
                title: 'Operasyonun geçmişi tek zaman çizelgesinde',
                body: 'Ne zaman ne olduğu, kim tarafından yapıldığı ve dosyanın nasıl bugüne geldiği kronolojik olarak izlenir.',
              },
            ].map((item) => (
              <StaggerItem key={item.title}>
                <div className="service-card h-full p-7">
                  <h3 className="font-heading text-lg text-fg">{item.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">{item.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── 11–12 · Data centre and integrations ───────────────────────── */}
      <section className="section border-t border-overlay/8">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <Heading
                eyebrow="Data Center"
                title="Dış ticaret veriniz için merkezî bir altyapı."
                lede="Havayolları, havalimanları, armatörler, limanlar, prefixler ve ülkeler gibi referans verileri merkezî olarak yönetilir; operasyon ve belge oluştururken kullanılır."
              />
              <div className="mt-8 flex flex-wrap gap-2">
                {['Havayolları', 'Havalimanları', 'Armatörler', 'Limanlar', 'Prefixler', 'Ülkeler'].map(
                  (item) => (
                    <span
                      key={item}
                      className="rounded-full border border-overlay/12 px-3 py-1.5 text-xs text-muted"
                    >
                      {item}
                    </span>
                  ),
                )}
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <Heading
                eyebrow="Entegrasyon"
                title="Mevcut sistemlerinizle birlikte çalışır."
                lede="Kullandığınız muhasebe altyapısıyla entegrasyon kurulabilir. LogiOps bu sistemlerin yerine geçmez; onlarla konuşur."
              />
              <div className="mt-8 flex flex-wrap gap-2">
                {['Logo', 'Uyumsoft'].map((item) => (
                  <span
                    key={item}
                    className="rounded-full px-4 py-1.5 text-xs font-medium"
                    style={{
                      border: '1px solid color-mix(in srgb, var(--gold) 45%, transparent)',
                      color: 'rgb(var(--c-fg))',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs text-faint">
                Diğer entegrasyonlar için ilerleyen sürümlerde genişletme hedefleniyor.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 13 · Today ─────────────────────────────────────────────────── */}
      <section id="bugun" className="section border-t border-overlay/8">
        <div className="container-x">
          <Reveal>
            <div className="max-w-3xl">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em]"
                style={{
                  border: '1px solid var(--gold)',
                  color: 'var(--gold)',
                }}
              >
                Bugün hazır
              </span>
              <h2 className="display-2 mt-6 text-fg">Bugün ne alıyorsunuz?</h2>
              <p className="prose-measure mt-5 text-base sm:text-lg">
                Aşağıdakiler bugün çalışan LogiOps kapsamındadır. Bu listenin altında kalan
                her şey gelecek vizyonudur ve öyle işaretlenmiştir.
              </p>
            </div>
          </Reveal>

          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.05}>
            {MVP.map((item) => (
              <StaggerItem key={item.title}>
                <div className="service-card h-full p-6">
                  <span
                    aria-hidden
                    className="block h-px w-8"
                    style={{ background: 'var(--gold)' }}
                  />
                  <h3 className="mt-4 font-heading text-base text-fg">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── 14–19 · Vision, on a different ground ──────────────────────── */}
      <section className="vision-band section">
        <div className="container-x">
          <Reveal>
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/70">
                Uzun vadeli vizyon
              </span>
              <h2 className="display-2 mt-6 text-white">Ve bu sadece başlangıç.</h2>
              <p className="mt-5 max-w-[62ch] text-base leading-relaxed text-white/65 sm:text-lg">
                Buradan sonrası platformun gelişim yönüdür. Hiçbiri bugün mevcut bir özellik
                değildir; hedeflenen, planlanan ve altyapısı hazırlanan yönlerdir.
              </p>
            </div>
          </Reveal>

          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" gap={0.06}>
            {VISION.map((item) => (
              <StaggerItem key={item.title}>
                <div className="h-full rounded-[var(--r-lg)] border border-white/10 bg-white/[0.03] p-6">
                  <h3 className="font-heading text-base text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{item.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          {/* Live data, drawn */}
          <Reveal delay={0.1}>
            <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <h3 className="font-heading text-xl text-white">Canlı veri akışı</h3>
                <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-white/60">
                  Bir operasyon dosyasındaki AWB numarası, ilgili taşıyıcıdan gelen bilginin
                  hangi dosyaya ait olduğunu söyler. İlerleyen sürümlerde bu bilginin doğrudan
                  o dosyaya düşmesi hedefleniyor.
                </p>
                <div className="mt-8 rounded-[var(--r-lg)] border border-white/10 bg-white/[0.02] p-6">
                  <ol className="space-y-3 text-sm text-white/70">
                    {[
                      'Havayolu / taşıyıcı / antrepo',
                      'API',
                      'LogiOps',
                      'İlgili operasyon dosyası',
                      'Timeline',
                    ].map((step, index) => (
                      <li key={step} className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 text-[0.65rem] text-white/50"
                        >
                          {index + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div>
                <h3 className="font-heading text-xl text-white">Gelişim yönü</h3>
                <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-white/60">
                  Bir takvim değil, bir yön. Platform bugün freight forwarder operasyonundan
                  başlıyor; hedef, dış ticaretin farklı taraflarını aynı altyapıda buluşturmak.
                </p>
                <div className="mt-8">
                  <GrowthLadder
                    stages={[
                      { label: 'Freight forwarder operasyonu', today: true },
                      { label: 'Entegrasyonlar' },
                      { label: 'Partnerler' },
                      { label: 'Müşteri portalı' },
                      { label: 'Gümrük' },
                      { label: 'Dış ticaret ekosistemi' },
                    ]}
                  />
                </div>
              </div>
            </div>
          </Reveal>

          {/* AI, last and in its place */}
          <Reveal delay={0.1}>
            <div className="mt-16 rounded-[var(--r-lg)] border border-white/10 bg-white/[0.03] p-8 sm:p-10">
              <h3 className="display-3 text-white">
                Veriniz büyüdükçe LogiOps daha akıllı hâle gelecek.
              </h3>
              <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-white/60">
                Yapay zekâ ürünün ilk satış argümanı değil, sonuncusu. Önce operasyon altyapısı,
                sonra veri, sonra entegrasyon, sonra dijital operasyon ağı — ve ancak bunların
                üzerine yapay zekâ. Yeterli operasyonel veriye ulaşıldığında belge oluşturma,
                eksik bilgi tespiti ve süreç otomasyonu gibi alanlarda kullanılması hedefleniyor.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['Operasyon altyapısı', 'Veri', 'Entegrasyon', 'Operasyon ağı', 'Yapay zekâ'].map(
                  (step, index) => (
                    <span key={step} className="flex items-center gap-2">
                      <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">
                        {step}
                      </span>
                      {index < 4 && (
                        <span aria-hidden className="text-white/25">
                          →
                        </span>
                      )}
                    </span>
                  ),
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 16 · Partner network ───────────────────────────────────────── */}
      <section className="section border-t border-overlay/8">
        <div className="container-x">
          <Reveal>
            <Heading
              eyebrow="Uzun vadeli vizyon"
              title="Aynı altyapıda buluşan taraflar."
              lede="Hedeflenen ekosistemde lojistik firmaları, gümrük müşavirleri, ithalatçılar, ihracatçılar, taşıyıcılar ve antrepolar aynı operasyon yapısı üzerinde çalışabilir."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-12">
              <ConvergeDiagram
                sources={['Havayolları', 'Armatörler', 'Antrepolar', 'Taşıyıcılar']}
                target="LogiOps"
                outcome="İlgili operasyon dosyası · Timeline"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 24 · Who it is for ─────────────────────────────────────────── */}
      <section className="section border-t border-overlay/8">
        <div className="container-x">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <Heading eyebrow="Kimler için" title="Bugün kimlerle çalışıyoruz?" />
              <ul className="mt-8 space-y-3">
                {[
                  'Freight forwarder firmaları',
                  'Lojistik firmaları',
                  'İthalat ve ihracat operasyonu yürüten firmalar',
                  'Operasyon, saha ve muhasebe ekipleri',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-muted">
                    <span
                      aria-hidden
                      className="h-px w-3 shrink-0"
                      style={{ background: 'var(--gold)' }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1}>
              <Heading eyebrow="Uzun vadede" title="Hedeflenen kullanıcı ekosistemi" />
              <ul className="mt-8 space-y-3">
                {[
                  'Gümrük müşavirleri',
                  'İthalatçılar ve ihracatçılar',
                  'Havayolları ve armatörler',
                  'Antrepolar ve taşıyıcılar',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-faint">
                    <span aria-hidden className="h-px w-3 shrink-0 bg-overlay/25" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 20 / 43 · Close ────────────────────────────────────────────── */}
      <section className="section border-t border-overlay/8">
        <div className="container-x">
          <Reveal>
            <div className="cta-band relative overflow-hidden rounded-[var(--r-xl)] px-6 py-16 sm:px-16 sm:py-20">
              <div className="rule-gold absolute inset-x-16 top-0" aria-hidden />
              <h2 className="display-2 max-w-3xl text-white" data-edit="logiops.closingTitle">
                {t(logiops.closingTitle) ||
                  'Bugün işinizi yönetin. Yarın platformunuz sizinle büyüsün.'}
              </h2>
              <p
                className="mt-5 max-w-[62ch] text-base leading-relaxed text-white/70 sm:text-lg"
                data-edit="logiops.closingBody"
              >
                {t(logiops.closingBody) ||
                  'LogiOps, dış ticaret operasyonlarını bugünden dijitalleştirirken geleceğin daha bağlantılı dış ticaret altyapısına doğru gelişmek üzere tasarlanıyor.'}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/contact"
                  data-cta="logiops-demo-final"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-ink-950 shadow-[var(--shadow-float)] transition-transform duration-[--t-fast] hover:-translate-y-0.5"
                >
                  Demo Talep Et
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#bugun"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-8 py-4 text-sm font-semibold text-white transition-colors hover:border-white/40"
                >
                  Bugün Hazır Olanları Gör
                </Link>
              </div>
              <p className="mt-6 text-sm text-white/45">
                Bugün çalışan çözümü keşfedin. Gelecekte gelişecek platformun bir parçası olun.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
