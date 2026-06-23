import { useRef, useState, useEffect } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Workflow, FileText, BarChart3, Archive, Shield, Users,
  CheckCircle2, ArrowRight, Zap, Play, ChevronDown,
  Clock, TrendingUp, AlertCircle
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

const features = [
  {
    icon: Workflow, color: '#6366f1',
    title: 'Workflow Builder',
    desc: 'Sürükle-bırak arayüzüyle iş akışlarınızı görsel olarak tasarlayın. Onay basamakları, koşullu yönlendirmeler ve otomatik tetikleyiciler.',
    details: ['Görsel workflow tasarımcısı', 'Koşullu akış kontrolü', 'Çoklu onay katmanları', 'Otomatik bildirimler'],
  },
  {
    icon: FileText, color: '#a855f7',
    title: 'Evrak Yönetimi',
    desc: 'Tüm operasyonel belgelerinizi yükleyin, kategorize edin ve anında erişin. Versiyon kontrolü ve arşivleme dahil.',
    details: ['Çoklu format desteği', 'Otomatik kategorilendirme', 'Versiyon kontrolü', 'Hızlı arama & filtre'],
  },
  {
    icon: BarChart3, color: '#06b6d4',
    title: 'Operasyon Takibi',
    desc: 'Tüm operasyonlarınızı tek ekrandan gerçek zamanlı takip edin. Durum güncellemeleri, süre analizleri ve performans metrikleri.',
    details: ['Gerçek zamanlı dashboard', 'Süre & performans analizi', 'Darboğaz tespiti', 'Özel KPI takibi'],
  },
  {
    icon: Archive, color: '#22c55e',
    title: 'Arşiv Sistemi',
    desc: 'Kapsamlı dijital arşiv altyapısıyla tüm geçmiş operasyonlarınıza ve belgelerinize anında erişin.',
    details: ['Akıllı arama motoru', 'Etiket & kategori yönetimi', 'Uzun süreli depolama', 'Hukuki uyumluluk desteği'],
  },
  {
    icon: Shield, color: '#f59e0b',
    title: 'Rol Bazlı Yetkilendirme',
    desc: 'Kullanıcı rolleri ve izin seviyeleri ile her çalışan sadece yetkili olduğu alanlara erişir.',
    details: ['Granüler izin kontrolü', 'Departman bazlı erişim', 'Audit log & izleme', 'SSO entegrasyonu'],
  },
  {
    icon: Users, color: '#ec4899',
    title: 'Firma Bazlı Özelleştirme',
    desc: 'Her firmanın iş modeline ve süreç yapısına uygun tamamen özelleştirilebilir yapılandırma seçenekleri.',
    details: ['Beyaz etiket seçeneği', 'Özel alan & formlar', 'Marka özelleştirme', 'API entegrasyonu'],
  },
]

const plans = [
  {
    name: 'Starter', price: 'İletişim', period: '',
    desc: 'KOBİ\'ler için temel operasyon yönetimi.',
    features: ['5 kullanıcıya kadar', 'Temel workflow', 'Evrak yönetimi', 'Email desteği'],
    cta: 'Demo Talep Et', primary: false,
  },
  {
    name: 'Business', price: 'İletişim', period: '',
    desc: 'Büyüyen şirketler için kapsamlı platform.',
    features: ['25 kullanıcıya kadar', 'Gelişmiş workflow', 'Arşiv sistemi', 'Rol yönetimi', 'Öncelikli destek'],
    cta: 'Demo Talep Et', primary: true,
  },
  {
    name: 'Enterprise', price: 'Özel Fiyat', period: '',
    desc: 'Kurumsal ölçek için tam özelleştirme.',
    features: ['Sınırsız kullanıcı', 'Tam özelleştirme', 'Özel entegrasyonlar', 'Dedicated destek', 'SLA garantisi'],
    cta: 'Teklif Al', primary: false,
  },
]

function LiveDashboard() {
  const [ops, setOps] = useState([
    { id: 1, name: 'Tedarik #4521', status: 'completed', time: '2d' },
    { id: 2, name: 'Evrak Onay #892', status: 'pending', time: '1s' },
    { id: 3, name: 'Lojistik #1147', status: 'active', time: '4s' },
    { id: 4, name: 'Arşivleme #303', status: 'completed', time: '1g' },
    { id: 5, name: 'Onay Akışı #77', status: 'pending', time: '30d' },
  ])

  const statusConfig = {
    active: { label: 'Aktif', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
    pending: { label: 'Bekliyor', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    completed: { label: 'Tamamlandı', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  }

  useEffect(() => {
    const t = setInterval(() => {
      setOps(prev => prev.map(op =>
        op.id === 2 ? { ...op, status: op.status === 'pending' ? 'active' : op.status === 'active' ? 'completed' : 'pending' } : op
      ))
    }, 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      background: 'rgba(5,5,15,0.8)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 40px 100px rgba(99,102,241,0.12)',
    }}>
      {/* Window bar */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
          <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
        ))}
        <span style={{ color: 'rgba(240,240,255,0.3)', fontSize: 12, marginLeft: 12 }}>
          LogiOps — Operasyon Yönetimi
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="status-dot" style={{ width: 6, height: 6 }} />
          <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 500 }}>Canlı</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr' }}>
        {/* Sidebar */}
        <div style={{ background: 'rgba(0,0,0,0.25)', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '16px 10px' }}>
          {[
            { icon: BarChart3, label: 'Dashboard', active: true },
            { icon: Workflow, label: 'Workflow', active: false },
            { icon: FileText, label: 'Evraklar', active: false },
            { icon: Archive, label: 'Arşiv', active: false },
            { icon: Users, label: 'Ekip', active: false },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 12px', borderRadius: 8, marginBottom: 3, cursor: 'pointer',
              background: item.active ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: item.active ? '#818cf8' : 'rgba(240,240,255,0.4)',
              fontSize: 13, fontWeight: item.active ? 600 : 400,
            }}>
              <item.icon size={15} />
              {item.label}
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{ padding: '20px' }}>
          {/* Header stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Toplam', value: '247', icon: BarChart3, color: '#6366f1' },
              { label: 'Aktif', value: '24', icon: TrendingUp, color: '#06b6d4' },
              { label: 'Bekleyen', value: '8', icon: Clock, color: '#f59e0b' },
              { label: 'Kritik', value: '2', icon: AlertCircle, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '10px 12px',
              }}>
                <div style={{ color: 'rgba(240,240,255,0.4)', fontSize: 10, marginBottom: 4 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: 20, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Ops list */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: 'rgba(240,240,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Son Operasyonlar
            </div>
            {ops.map(op => {
              const cfg = statusConfig[op.status]
              return (
                <motion.div
                  key={op.id}
                  layout
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 8, marginBottom: 6,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
                    <span style={{ color: 'rgba(240,240,255,0.7)', fontSize: 12 }}>{op.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'rgba(240,240,255,0.3)', fontSize: 11 }}>{op.time}</span>
                    <motion.span
                      key={op.status}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{
                        fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}25`,
                      }}
                    >
                      {cfg.label}
                    </motion.span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Product() {
  return (
    <div style={{ paddingTop: 70 }}>
      {/* Hero */}
      <section style={{ position: 'relative', padding: '100px 0 60px', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/assets/banners/analytics-banner.svg)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.5,
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,9,15,0.55)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} style={{ maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
            <div className="section-label" style={{ background: 'rgba(8,145,178,0.12)', border: '1px solid rgba(8,145,178,0.35)', color: '#67e8f9' }}>
              <Zap size={13} /> SaaS Platform
            </div>
            <h1 style={{
              fontSize: 'clamp(38px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.05,
              letterSpacing: '-2px', color: '#f0f0ff', marginBottom: 24, marginTop: 16,
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              <span className="gradient-text">LogiOps</span><br />
              Operasyonlarınızı Yönetin
            </h1>
            <p style={{ color: 'rgba(240,240,255,0.6)', fontSize: 18, lineHeight: 1.7, marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
              Workflow automation, evrak yönetimi ve operasyon takibini tek platformda birleştiren
              kurumsal SaaS çözümü.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/iletisim" style={{ textDecoration: 'none' }}>
                <button className="btn-primary" style={{ padding: '14px 30px', fontSize: 16 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Demo Talep Et <ArrowRight size={16} /></span>
                </button>
              </Link>
              <button className="btn-secondary" style={{ padding: '14px 30px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Play size={15} /> Demo İzle
              </button>
            </div>
          </motion.div>

          {/* Live dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            style={{ marginTop: 70, maxWidth: 860, margin: '70px auto 0' }}
          >
            <LiveDashboard />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '100px 0', background: 'rgba(5,5,15,0.5)' }}>
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="section-label" style={{ background: 'rgba(8,145,178,0.12)', border: '1px solid rgba(8,145,178,0.35)', color: '#67e8f9' }}>
                Platform Özellikleri
              </div>
              <h2 style={{
                fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, color: '#f0f0ff',
                letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif",
              }}>
                Operasyonun Her Boyutu<br />
                <span className="gradient-text">Tek Platformda</span>
              </h2>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 22 }}>
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.08}>
                <div className="glass" style={{ padding: '36px 30px', height: '100%' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: `${f.color}18`, border: `1px solid ${f.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
                  }}>
                    <f.icon size={24} color={f.color} />
                  </div>
                  <h3 style={{ color: '#f0f0ff', fontSize: 19, fontWeight: 700, marginBottom: 12, fontFamily: "'Space Grotesk', sans-serif" }}>{f.title}</h3>
                  <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>{f.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {f.details.map(d => (
                      <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <CheckCircle2 size={13} color={f.color} style={{ flexShrink: 0 }} />
                        <span style={{ color: 'rgba(240,240,255,0.6)', fontSize: 13 }}>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '100px 0' }}>
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="section-label">Paketler</div>
              <h2 style={{
                fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, color: '#f0f0ff',
                letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif",
              }}>
                Şirketinize Uygun <span className="gradient-text">Plan</span>
              </h2>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 960, margin: '0 auto' }}>
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.1}>
                <div style={{
                  padding: '36px 32px',
                  background: plan.primary
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${plan.primary ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 20, height: '100%', position: 'relative',
                  boxShadow: plan.primary ? '0 20px 60px rgba(99,102,241,0.15)' : 'none',
                }}>
                  {plan.primary && (
                    <div style={{
                      position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                      color: 'white', fontSize: 11, fontWeight: 700,
                      padding: '4px 16px', borderRadius: 20, whiteSpace: 'nowrap',
                    }}>
                      Popüler
                    </div>
                  )}
                  <h3 style={{ color: '#f0f0ff', fontSize: 22, fontWeight: 700, marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif" }}>{plan.name}</h3>
                  <p style={{ color: 'rgba(240,240,255,0.45)', fontSize: 13, marginBottom: 28 }}>{plan.desc}</p>
                  <div style={{ marginBottom: 28 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <CheckCircle2 size={14} color="#818cf8" style={{ flexShrink: 0 }} />
                        <span style={{ color: 'rgba(240,240,255,0.65)', fontSize: 14 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/iletisim" style={{ textDecoration: 'none', display: 'block' }}>
                    <button
                      className={plan.primary ? 'btn-primary' : 'btn-secondary'}
                      style={{ width: '100%', padding: '12px', fontSize: 15 }}
                    >
                      {plan.primary ? <span>{plan.cta}</span> : plan.cta}
                    </button>
                  </Link>
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
                fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, color: '#f0f0ff',
                marginBottom: 16, fontFamily: "'Space Grotesk', sans-serif",
              }}>
                LogiOps&apos;u Denemeye Hazır mısınız?
              </h2>
              <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 17, marginBottom: 36 }}>
                Ekibimizle canlı demo planlayın, platformu keşfedin.
              </p>
              <Link to="/iletisim" style={{ textDecoration: 'none' }}>
                <button className="btn-primary" style={{ padding: '14px 36px', fontSize: 17, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Ücretsiz Demo Al <Zap size={16} /></span>
                </button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  )
}
