import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ChevronRight, Zap, BarChart3, FileText,
  Settings, Shield, Users, TrendingUp, CheckCircle2,
  Workflow, Database, Globe
} from 'lucide-react'

function useCounter(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime = null
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

function CounterCard({ value, suffix, label, icon: Icon, delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const count = useCounter(value, 2200, inView)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      className="glass"
      style={{ padding: '32px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 16,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08), transparent 70%)',
      }} />
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
        border: '1px solid rgba(99,102,241,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <Icon size={20} color="#818cf8" />
      </div>
      <div style={{
        fontSize: 44, fontWeight: 800, lineHeight: 1,
        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text', marginBottom: 8,
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        {count}{suffix}
      </div>
      <p style={{ color: 'rgba(240,240,255,0.55)', fontSize: 14, fontWeight: 500 }}>{label}</p>
    </motion.div>
  )
}

const features = [
  {
    icon: Workflow,
    title: 'Workflow Automation',
    desc: 'Tekrarlayan süreçleri otomatikleştirin. LogiOps ile iş akışlarınızı görsel olarak tasarlayın.',
    color: '#6366f1',
  },
  {
    icon: FileText,
    title: 'Evrak Yönetimi',
    desc: 'Tüm belgelerinizi dijital ortamda arşivleyin, yönetin ve anlık erişin.',
    color: '#a855f7',
  },
  {
    icon: BarChart3,
    title: 'Operasyon Takibi',
    desc: 'Gerçek zamanlı dashboard\'larla operasyonlarınızın nabzını tutun.',
    color: '#06b6d4',
  },
  {
    icon: Shield,
    title: 'Rol Bazlı Yetkilendirme',
    desc: 'Her kullanıcı yalnızca yetkili olduğu verilere ve işlemlere erişir.',
    color: '#22c55e',
  },
  {
    icon: Settings,
    title: 'Özelleştirilebilir Süreçler',
    desc: 'Her firmanın iş modeline uygun, tamamen özelleştirilebilir yapılandırma.',
    color: '#f59e0b',
  },
  {
    icon: Database,
    title: 'Merkezi Veri Yönetimi',
    desc: 'Dağınık Excel dosyaları yerine tek bir platformda tüm operasyonel veriler.',
    color: '#ec4899',
  },
]

const services = [
  { icon: Globe, label: 'Dijital Dönüşüm' },
  { icon: TrendingUp, label: 'Süreç Optimizasyonu' },
  { icon: Settings, label: 'Yazılım Entegrasyonu' },
  { icon: Users, label: 'Operasyon Tasarımı' },
]

function FadeIn({ children, delay = 0, y = 30 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  return (
    <div style={{ paddingTop: 70 }}>
      {/* HERO */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        {/* Hero banner background */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'url(/assets/banners/hero-banner.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          opacity: 0.85,
        }} />
        {/* Overlay for text legibility */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'linear-gradient(to bottom, rgba(4,9,15,0.55) 0%, rgba(4,9,15,0.3) 50%, rgba(4,9,15,0.85) 100%)',
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 1, paddingTop: 80, paddingBottom: 80 }}>
          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="section-label" style={{ marginBottom: 28 }}>
                <div className="status-dot" />
                <span>Nexuva × LogiOps Platform</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              style={{
                fontSize: 'clamp(38px, 6vw, 72px)',
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-2px',
                color: '#f0f0ff',
                marginBottom: 24,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Modern Şirketler İçin{' '}
              <span className="gradient-text">Operasyonel Zekâ</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              style={{
                fontSize: 'clamp(16px, 2vw, 20px)',
                color: 'rgba(240,240,255,0.6)',
                lineHeight: 1.7,
                marginBottom: 44,
                maxWidth: 580,
                margin: '0 auto 44px',
              }}
            >
              Nexuva danışmanlığı ile süreçlerini dönüştür,{' '}
              <span style={{ color: 'rgba(240,240,255,0.85)' }}>LogiOps</span> ile operasyonlarını yönet.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}
            >
              <Link to="/iletisim" style={{ textDecoration: 'none' }}>
                <button className="btn-primary" style={{ padding: '14px 30px', fontSize: 16 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    Demo Talep Et <ArrowRight size={16} />
                  </span>
                </button>
              </Link>
              <Link to="/logiops" style={{ textDecoration: 'none' }}>
                <button className="btn-secondary" style={{ padding: '14px 30px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  LogiOps&apos;u İncele <ChevronRight size={16} />
                </button>
              </Link>
            </motion.div>
          </div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ marginTop: 80, position: 'relative' }}
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </section>

      {/* COUNTERS */}
      <section style={{ padding: '80px 0', background: 'rgba(5,5,15,0.5)' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
          }}>
            <CounterCard value={50} suffix="+" label="Aktif Müşteri" icon={Users} delay={0} />
            <CounterCard value={10000} suffix="+" label="Yönetilen Operasyon" icon={TrendingUp} delay={0.1} />
            <CounterCard value={25000} suffix="+" label="Dijital Evrak" icon={FileText} delay={0.2} />
            <CounterCard value={98} suffix="%" label="Müşteri Memnuniyeti" icon={CheckCircle2} delay={0.3} />
          </div>
        </div>
      </section>

      {/* SERVICES OVERVIEW */}
      <section className="section">
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="section-label">Danışmanlık Hizmetleri</div>
              <h2 style={{
                fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800,
                color: '#f0f0ff', letterSpacing: '-1px',
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                Dijital Dönüşümde<br />
                <span className="gradient-text">Güvenilir Ortağınız</span>
              </h2>
              <p style={{ color: 'rgba(240,240,255,0.5)', marginTop: 16, fontSize: 17, maxWidth: 480, margin: '16px auto 0' }}>
                Nexuva, operasyonlarınızı analiz eder, süreçlerinizi tasarlar ve teknolojiyle entegre eder.
              </p>
            </div>
          </FadeIn>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16, marginBottom: 48,
          }}>
            {services.map((s, i) => (
              <FadeIn key={s.label} delay={i * 0.1}>
                <div className="glass" style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
                    border: '1px solid rgba(99,102,241,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <s.icon size={18} color="#818cf8" />
                  </div>
                  <span style={{ color: 'rgba(240,240,255,0.85)', fontSize: 15, fontWeight: 500 }}>{s.label}</span>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.3}>
            <div style={{ textAlign: 'center' }}>
              <Link to="/hizmetler" style={{ textDecoration: 'none' }}>
                <button className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 26px' }}>
                  Tüm Hizmetleri Gör <ArrowRight size={16} />
                </button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* LOGIOPS FEATURES */}
      <section className="section" style={{ background: 'rgba(5,5,15,0.5)' }}>
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="section-label" style={{
                background: 'rgba(168,85,247,0.1)',
                border: '1px solid rgba(168,85,247,0.3)',
                color: '#c084fc',
              }}>
                LogiOps Platform
              </div>
              <h2 style={{
                fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800,
                color: '#f0f0ff', letterSpacing: '-1px',
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                Operasyonlarınızı<br />
                <span className="gradient-text-2">Tamamen Dijitalleştirin</span>
              </h2>
            </div>
          </FadeIn>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
          }}>
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.08}>
                <div className="glass" style={{ padding: '32px 28px', height: '100%' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 13,
                    background: `${f.color}18`,
                    border: `1px solid ${f.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                  }}>
                    <f.icon size={22} color={f.color} />
                  </div>
                  <h3 style={{ color: '#f0f0ff', fontSize: 17, fontWeight: 600, marginBottom: 10 }}>{f.title}</h3>
                  <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.3}>
            <div style={{ textAlign: 'center', marginTop: 48 }}>
              <Link to="/logiops" style={{ textDecoration: 'none' }}>
                <button className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 30px', fontSize: 16 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    LogiOps&apos;u Keşfet <Zap size={16} />
                  </span>
                </button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ padding: '100px 0', position: 'relative', overflow: 'hidden' }}>
        {/* CTA SVG Banner as background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/assets/banners/cta-banner.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.6,
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(4,9,15,0.5), rgba(4,9,15,0.5))',
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <FadeIn>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{
                fontSize: 'clamp(26px, 4vw, 52px)', fontWeight: 800,
                color: '#e0f2fe', marginBottom: 16, letterSpacing: '-1px',
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                Operasyonlarınızı Dönüştürmeye<br />
                <span className="gradient-text">Bugün Başlayın</span>
              </h2>
              <p style={{ color: 'rgba(224,242,254,0.6)', fontSize: 18, marginBottom: 44 }}>
                Nexuva ekibiyle ücretsiz danışmanlık görüşmesi planlayın.
              </p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/iletisim" style={{ textDecoration: 'none' }}>
                  <button className="btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      Demo Talep Et <ArrowRight size={16} />
                    </span>
                  </button>
                </Link>
                <Link to="/referanslar" style={{ textDecoration: 'none' }}>
                  <button className="btn-secondary" style={{ padding: '14px 32px', fontSize: 16 }}>
                    Başarı Hikayelerini Gör
                  </button>
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  )
}

function DashboardMockup() {
  const [activeStatus, setActiveStatus] = useState(0)
  const statuses = ['Beklemede', 'İşlemde', 'Tamamlandı']
  const colors = ['#f59e0b', '#6366f1', '#22c55e']

  useEffect(() => {
    const t = setInterval(() => setActiveStatus(s => (s + 1) % 3), 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      maxWidth: 900,
      margin: '0 auto',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 40px 120px rgba(99,102,241,0.15), 0 0 0 1px rgba(255,255,255,0.05)',
    }}>
      {/* Window bar */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
        ))}
        <div style={{
          flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6,
          padding: '5px 14px', fontSize: 12, color: 'rgba(240,240,255,0.3)',
          marginLeft: 12, maxWidth: 300,
        }}>
          logiops.nexuva.com
        </div>
      </div>

      {/* Dashboard body */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 400 }}>
        {/* Sidebar */}
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          padding: '20px 12px',
        }}>
          {['Dashboard', 'Operasyonlar', 'Evraklar', 'Workflow', 'Raporlar'].map((item, i) => (
            <div key={item} style={{
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? '#818cf8' : 'rgba(240,240,255,0.4)',
              background: i === 0 ? 'rgba(99,102,241,0.12)' : 'transparent',
              marginBottom: 4,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              {item}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ padding: '24px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ color: '#f0f0ff', fontWeight: 600, fontSize: 16 }}>Operasyonlar</div>
            <div style={{
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              color: 'white', fontSize: 11, fontWeight: 600,
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
            }}>
              + Yeni Operasyon
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Aktif', value: '24', color: '#6366f1' },
              { label: 'Bekleyen', value: '8', color: '#f59e0b' },
              { label: 'Tamamlanan', value: '156', color: '#22c55e' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{ color: 'rgba(240,240,255,0.45)', fontSize: 11, marginBottom: 6 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Table rows */}
          {['Tedarik Süreci', 'Evrak Arşivleme', 'Onay Akışı'].map((op, i) => (
            <motion.div
              key={op}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                marginBottom: 8,
              }}
              animate={i === 1 && activeStatus === 1 ? { borderColor: 'rgba(99,102,241,0.3)' } : {}}
            >
              <div style={{ color: 'rgba(240,240,255,0.75)', fontSize: 13 }}>{op}</div>
              <motion.div
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                  background: `${colors[i === 1 ? activeStatus : i]}18`,
                  color: colors[i === 1 ? activeStatus : i],
                  border: `1px solid ${colors[i === 1 ? activeStatus : i]}30`,
                }}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {i === 1 ? statuses[activeStatus] : statuses[i]}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
