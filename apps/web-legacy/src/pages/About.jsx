import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Target, Eye, Lightbulb, ArrowRight, Users, Award, TrendingUp } from 'lucide-react'

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

const timeline = [
  { year: '2021', title: 'Nexuva Kuruluyor', desc: 'Dijital dönüşüm ihtiyacını fark eden bir ekip, Nexuva\'yı kurdu.' },
  { year: '2022', title: 'İlk Kurumsal Projeler', desc: 'İlk büyük ölçekli operasyon optimizasyon projeleri tamamlandı.' },
  { year: '2023', title: 'LogiOps Geliştirme', desc: 'Kendi SaaS ürünümüz LogiOps\'un geliştirme süreci başladı.' },
  { year: '2024', title: 'LogiOps Lansman', desc: 'LogiOps ilk müşterilere sunuldu, 25+ firma operasyonlarını dijitalleştirdi.' },
  { year: '2025', title: 'Büyüme & Ölçekleme', desc: '50+ aktif müşteri, 10.000+ yönetilen operasyon ile sektör lideri konuma gelindi.' },
]

const values = [
  { icon: Target, title: 'Sonuç Odaklılık', desc: 'Her proje için net ve ölçülebilir sonuçlar hedefliyoruz.' },
  { icon: Lightbulb, title: 'İnovasyon', desc: 'Kendi SaaS ürünümüzü geliştirerek sektörde fark yaratıyoruz.' },
  { icon: Users, title: 'Ortaklık Yaklaşımı', desc: 'Müşterilerimizle danışman değil, stratejik ortak olarak çalışıyoruz.' },
  { icon: Award, title: 'Kalite Standartları', desc: 'Her süreçte en yüksek kalite ve güvenilirlik standartlarını uyguluyoruz.' },
]

export default function About() {
  return (
    <div style={{ paddingTop: 70 }}>
      {/* Hero */}
      <section style={{ position: 'relative', padding: '100px 0 80px', overflow: 'hidden' }}>
        <div className="mesh-bg">
          <div className="mesh-orb" style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', top: -100, right: -100 }} />
        </div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div className="section-label">Hakkımızda</div>
            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 62px)', fontWeight: 800, lineHeight: 1.1,
              letterSpacing: '-2px', color: '#f0f0ff', marginBottom: 24,
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Teknoloji Üretip <br />
              <span className="gradient-text">Dönüşüm Yaratan</span> Şirket
            </h1>
            <p style={{ color: 'rgba(240,240,255,0.55)', fontSize: 18, lineHeight: 1.7 }}>
              Nexuva, operasyonel süreçleri dijitalleştiren ve kendi SaaS ürünü LogiOps ile
              kurumsal iş dünyasının verimliliğini kökten değiştiren bir teknoloji şirketidir.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section style={{ padding: '80px 0', background: 'rgba(5,5,15,0.5)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {[
              { icon: Target, label: 'Misyonumuz', color: '#6366f1',
                text: 'Türk iş dünyasının operasyonel süreçlerini modern teknoloji ile buluşturmak; dağınık Excel tablolarını, kağıt süreçlerini ve manuel operasyonları tamamen dijitalleştirmek.' },
              { icon: Eye, label: 'Vizyonumuz', color: '#a855f7',
                text: 'Operasyon yönetiminde Türkiye\'nin en güvenilir teknoloji platformu olmak. LogiOps ile kurumsal iş dünyasının standart operasyon altyapısını oluşturmak.' },
            ].map((item, i) => (
              <FadeIn key={item.label} delay={i * 0.15}>
                <div className="glass" style={{ padding: '40px 36px', height: '100%' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: `${item.color}18`, border: `1px solid ${item.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
                  }}>
                    <item.icon size={24} color={item.color} />
                  </div>
                  <h3 style={{ color: '#f0f0ff', fontSize: 22, fontWeight: 700, marginBottom: 16, fontFamily: "'Space Grotesk', sans-serif" }}>{item.label}</h3>
                  <p style={{ color: 'rgba(240,240,255,0.55)', lineHeight: 1.75, fontSize: 15 }}>{item.text}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Stats banner */}
      <section style={{ padding: '70px 0' }}>
        <div className="container">
          <FadeIn>
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.08))',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 20, padding: '48px 40px',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 40, textAlign: 'center',
            }}>
              {[
                { value: '50+', label: 'Aktif Müşteri', icon: Users },
                { value: '4+', label: 'Yıllık Deneyim', icon: Award },
                { value: '10K+', label: 'Operasyon', icon: TrendingUp },
                { value: '98%', label: 'Memnuniyet', icon: Target },
              ].map(s => (
                <div key={s.label}>
                  <div style={{
                    fontSize: 38, fontWeight: 800,
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                    fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8,
                  }}>{s.value}</div>
                  <div style={{ color: 'rgba(240,240,255,0.5)', fontSize: 14 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Timeline */}
      <section style={{ padding: '80px 0', background: 'rgba(5,5,15,0.5)' }}>
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="section-label">Yolculuğumuz</div>
              <h2 style={{
                fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#f0f0ff',
                letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif",
              }}>Nexuva&apos;nın Hikayesi</h2>
            </div>
          </FadeIn>
          <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 50, top: 0, bottom: 0, width: 1,
              background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.4), transparent)',
            }} />
            {timeline.map((item, i) => (
              <FadeIn key={item.year} delay={i * 0.1}>
                <div style={{ display: 'flex', gap: 32, marginBottom: 40, alignItems: 'flex-start' }}>
                  <div style={{ width: 100, flexShrink: 0, textAlign: 'right' }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: '#818cf8',
                      background: 'rgba(99,102,241,0.12)', padding: '4px 10px', borderRadius: 6,
                    }}>{item.year}</span>
                  </div>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    boxShadow: '0 0 12px rgba(99,102,241,0.6)',
                  }} />
                  <div className="glass" style={{ padding: '20px 24px', flex: 1 }}>
                    <h4 style={{ color: '#f0f0ff', fontWeight: 600, marginBottom: 8, fontSize: 16 }}>{item.title}</h4>
                    <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 14, lineHeight: 1.7 }}>{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div className="section-label">Değerlerimiz</div>
              <h2 style={{
                fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#f0f0ff',
                letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif",
              }}>Bizi Biz Yapan <span className="gradient-text">İlkeler</span></h2>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {values.map((v, i) => (
              <FadeIn key={v.title} delay={i * 0.1}>
                <div className="glass" style={{ padding: '32px 28px', textAlign: 'center' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14, margin: '0 auto 20px',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                    border: '1px solid rgba(99,102,241,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <v.icon size={22} color="#818cf8" />
                  </div>
                  <h3 style={{ color: '#f0f0ff', fontSize: 17, fontWeight: 600, marginBottom: 12 }}>{v.title}</h3>
                  <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 14, lineHeight: 1.7 }}>{v.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', background: 'rgba(5,5,15,0.5)' }}>
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{
                fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 800, color: '#f0f0ff',
                marginBottom: 16, fontFamily: "'Space Grotesk', sans-serif",
              }}>Birlikte Çalışalım</h2>
              <p style={{ color: 'rgba(240,240,255,0.5)', marginBottom: 36, fontSize: 17 }}>
                Operasyonlarınızı dönüştürmek için ilk adımı atın.
              </p>
              <Link to="/iletisim" style={{ textDecoration: 'none' }}>
                <button className="btn-primary" style={{ padding: '14px 32px', fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>İletişime Geç <ArrowRight size={16} /></span>
                </button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  )
}
