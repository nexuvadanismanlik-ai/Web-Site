import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Globe, TrendingUp, Settings, Workflow, BarChart3, Layers,
  CheckCircle2, ArrowRight, Zap
} from 'lucide-react'

function FadeIn({ children, delay = 0, y = 30 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >{children}</motion.div>
  )
}

const services = [
  {
    icon: Globe,
    color: '#6366f1',
    title: 'Dijital Dönüşüm Danışmanlığı',
    desc: 'Şirketinizin dijital olgunluğunu değerlendirip, kademeli ve sürdürülebilir bir dönüşüm yol haritası oluştururuz.',
    items: [
      'Dijital olgunluk analizi',
      'Dönüşüm yol haritası',
      'Teknoloji seçim danışmanlığı',
      'Değişim yönetimi desteği',
    ],
  },
  {
    icon: Layers,
    color: '#a855f7',
    title: 'Operasyon Tasarımı',
    desc: 'Mevcut operasyonel yapınızı analiz eder, verimsizlikleri tespit eder ve optimize bir operasyon modeli tasarlarız.',
    items: [
      'Süreç haritalama (AS-IS)',
      'Optimum model tasarımı (TO-BE)',
      'KPI belirleme ve takip sistemi',
      'Ekip yapısı optimizasyonu',
    ],
  },
  {
    icon: TrendingUp,
    color: '#06b6d4',
    title: 'Süreç Optimizasyonu',
    desc: 'Tekrarlayan ve manuel süreçleri analiz eder, otomasyon fırsatlarını belirler ve operasyonel verimliliği artırırız.',
    items: [
      'Darboğaz analizi',
      'Süreç standardizasyonu',
      'Otomasyon fırsatı tespiti',
      'Verimlilik ölçümleme',
    ],
  },
  {
    icon: Settings,
    color: '#22c55e',
    title: 'Yazılım Entegrasyonu',
    desc: 'Mevcut sistemlerinizi birbirine bağlar, veri silolarını ortadan kaldırır ve entegre bir teknoloji ekosistemi kurarsınız.',
    items: [
      'ERP / CRM entegrasyonları',
      'API geliştirme ve yönetimi',
      'Veri akışı tasarımı',
      'Sistem konsolidasyonu',
    ],
  },
  {
    icon: Workflow,
    color: '#f59e0b',
    title: 'Workflow Analizi',
    desc: 'İş akışlarınızı detaylı analiz eder, LogiOps ile otomatize eder ve verimliliği somut metriklerle ölçersiniz.',
    items: [
      'Workflow haritalama',
      'Approval süreç tasarımı',
      'Otomasyon implementasyonu',
      'Performans izleme',
    ],
  },
  {
    icon: BarChart3,
    color: '#ec4899',
    title: 'Veri & Raporlama Altyapısı',
    desc: 'Operasyonel verileri anlamlı içgörülere dönüştüren dashboard ve raporlama altyapısını kurarsınız.',
    items: [
      'Operasyonel KPI dashboard',
      'Gerçek zamanlı raporlama',
      'Veri görselleştirme',
      'Yönetici raporları',
    ],
  },
]

const process = [
  { step: '01', title: 'Keşif & Analiz', desc: 'Mevcut durumu analiz eder, sorunları ve fırsatları tespit ederiz.' },
  { step: '02', title: 'Strateji & Tasarım', desc: 'Şirketinize özel dönüşüm stratejisi ve çözüm modeli tasarlarız.' },
  { step: '03', title: 'Uygulama', desc: 'Belirlenen çözümleri adım adım hayata geçirir, süreci yönetiriz.' },
  { step: '04', title: 'Ölçüm & Optimizasyon', desc: 'Sonuçları ölçer, raporlar ve sürekli iyileştirme sağlarız.' },
]

export default function Services() {
  return (
    <div style={{ paddingTop: 70 }}>
      {/* Hero */}
      <section style={{ position: 'relative', padding: '100px 0 80px', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/assets/banners/features-banner.svg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.45,
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,9,15,0.6)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div className="section-label">Hizmetlerimiz</div>
            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 62px)', fontWeight: 800, lineHeight: 1.1,
              letterSpacing: '-2px', color: '#f0f0ff', marginBottom: 24,
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Operasyondan Stratejiye<br />
              <span className="gradient-text">Uçtan Uca Çözümler</span>
            </h1>
            <p style={{ color: 'rgba(240,240,255,0.55)', fontSize: 18, lineHeight: 1.7 }}>
              Nexuva, şirketinizin dijital dönüşüm yolculuğunun her aşamasında yanınızda.
              Analiz, tasarım, uygulama ve sürekli optimizasyon.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services grid */}
      <section style={{ padding: '80px 0', background: 'rgba(5,5,15,0.5)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {services.map((s, i) => (
              <FadeIn key={s.title} delay={i * 0.08}>
                <div className="glass" style={{ padding: '36px 32px', height: '100%' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: `${s.color}18`, border: `1px solid ${s.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
                  }}>
                    <s.icon size={24} color={s.color} />
                  </div>
                  <h3 style={{ color: '#f0f0ff', fontSize: 19, fontWeight: 700, marginBottom: 12, fontFamily: "'Space Grotesk', sans-serif" }}>{s.title}</h3>
                  <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>{s.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {s.items.map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CheckCircle2 size={14} color={s.color} style={{ flexShrink: 0 }} />
                        <span style={{ color: 'rgba(240,240,255,0.65)', fontSize: 13 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="section-label">Nasıl Çalışıyoruz</div>
              <h2 style={{
                fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#f0f0ff',
                letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif",
              }}>Kanıtlanmış <span className="gradient-text">Metodoloji</span></h2>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {process.map((p, i) => (
              <FadeIn key={p.step} delay={i * 0.12}>
                <div className="glass" style={{ padding: '32px 28px', textAlign: 'center', position: 'relative' }}>
                  <div style={{
                    fontSize: 48, fontWeight: 900, lineHeight: 1,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3))',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                    fontFamily: "'Space Grotesk', sans-serif", marginBottom: 16,
                  }}>{p.step}</div>
                  <h4 style={{ color: '#f0f0ff', fontWeight: 600, fontSize: 16, marginBottom: 10 }}>{p.title}</h4>
                  <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 13, lineHeight: 1.7 }}>{p.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* LogiOps CTA */}
      <section style={{ padding: '80px 0', background: 'rgba(5,5,15,0.5)' }}>
        <div className="container">
          <FadeIn>
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 24, padding: '64px 48px', textAlign: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
                width: 400, height: 300,
                background: 'radial-gradient(ellipse, rgba(99,102,241,0.18), transparent 70%)',
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="section-label" style={{ marginBottom: 24 }}>
                  <Zap size={14} /> Dahili SaaS Platformumuz
                </div>
                <h2 style={{
                  fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, color: '#f0f0ff',
                  marginBottom: 16, fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  Danışmanlıkla Birlikte<br />
                  <span className="gradient-text">LogiOps ile Uygula</span>
                </h2>
                <p style={{ color: 'rgba(240,240,255,0.55)', fontSize: 17, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
                  Süreçlerinizi tasarladıktan sonra LogiOps ile dijitalleşin.
                  Danışmanlık + SaaS entegrasyonu ile en hızlı dönüşüm.
                </p>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link to="/logiops" style={{ textDecoration: 'none' }}>
                    <button className="btn-primary" style={{ padding: '14px 30px', fontSize: 16 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>LogiOps&apos;u İncele <ArrowRight size={16} /></span>
                    </button>
                  </Link>
                  <Link to="/iletisim" style={{ textDecoration: 'none' }}>
                    <button className="btn-secondary" style={{ padding: '14px 30px', fontSize: 16 }}>Demo Talep Et</button>
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  )
}
