import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, TrendingUp, Clock, FileText, CheckCircle2, XCircle, Zap } from 'lucide-react'

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

const cases = [
  {
    company: 'Büyük Ölçekli Lojistik Firması',
    industry: 'Lojistik & Tedarik Zinciri',
    color: '#6366f1',
    challenge: 'Günlük 200+ operasyon Excel ile yönetiliyordu. Veri kaybı, gecikme ve raporlama sorunları yaşanıyordu.',
    solution: 'LogiOps ile tüm operasyon süreçleri dijitalleştirildi. Otomatik workflow ve gerçek zamanlı takip devreye alındı.',
    results: [
      { label: 'Operasyon Hızı', value: '+340%', icon: TrendingUp },
      { label: 'Süreç Süresi', value: '-65%', icon: Clock },
      { label: 'Hata Oranı', value: '-92%', icon: CheckCircle2 },
    ],
    timeline: [
      { phase: 'Analiz', duration: '2 hafta', desc: 'Mevcut süreç haritalama ve sorun tespiti' },
      { phase: 'Tasarım', duration: '3 hafta', desc: 'LogiOps yapılandırması ve workflow tasarımı' },
      { phase: 'Geçiş', duration: '4 hafta', desc: 'Kademeli geçiş ve ekip eğitimi' },
      { phase: 'Stabilizasyon', duration: '2 hafta', desc: 'İyileştirme ve performans optimizasyonu' },
    ],
  },
  {
    company: 'Orta Ölçekli Üretim Şirketi',
    industry: 'İmalat & Üretim',
    color: '#a855f7',
    challenge: '5 farklı departman kendi Excel dosyalarını tutuyordu. Onay süreçleri e-posta zincirlerine bağımlıydı.',
    solution: 'Merkezi evrak yönetimi ve rol bazlı onay workflow\'ları kuruldu. Tüm departmanlar tek platformda toplandı.',
    results: [
      { label: 'Onay Süresi', value: '-78%', icon: Clock },
      { label: 'Evrak Erişimi', value: '+Anlık', icon: FileText },
      { label: 'Maliyet Tasarrufu', value: '%40', icon: TrendingUp },
    ],
    timeline: [
      { phase: 'Keşif', duration: '1 hafta', desc: 'Departman bazlı süreç analizi' },
      { phase: 'Konfigürasyon', duration: '2 hafta', desc: 'LogiOps özelleştirme ve entegrasyon' },
      { phase: 'Pilot', duration: '3 hafta', desc: '1 departmanla pilot uygulama' },
      { phase: 'Tam Geçiş', duration: '3 hafta', desc: 'Tüm şirkete yaygınlaştırma' },
    ],
  },
]

export default function CaseStudies() {
  return (
    <div style={{ paddingTop: 70 }}>
      {/* Hero */}
      <section style={{ position: 'relative', padding: '100px 0 80px', overflow: 'hidden' }}>
        <div className="mesh-bg">
          <div className="mesh-orb" style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 70%)', top: -100, left: '30%' }} />
        </div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div className="section-label">Referanslar</div>
            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 62px)', fontWeight: 800, lineHeight: 1.1,
              letterSpacing: '-2px', color: '#f0f0ff', marginBottom: 24,
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Gerçek Dönüşümler,<br />
              <span className="gradient-text">Kanıtlanmış Sonuçlar</span>
            </h1>
            <p style={{ color: 'rgba(240,240,255,0.55)', fontSize: 18, lineHeight: 1.7 }}>
              Nexuva ve LogiOps ile operasyonlarını dönüştüren firmaların başarı hikayeleri.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Before / After comparison */}
      <section style={{ padding: '60px 0', background: 'rgba(5,5,15,0.5)' }}>
        <div className="container">
          <FadeIn>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div className="section-label">Dönüşüm Etkisi</div>
              <h2 style={{
                fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 800, color: '#f0f0ff',
                letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif",
              }}>Excel&apos;den LogiOps&apos;a</h2>
            </div>
          </FadeIn>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 860, margin: '0 auto' }}>
            {/* Before */}
            <FadeIn delay={0}>
              <div style={{
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 20, padding: '32px 28px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 20, letterSpacing: 1, textTransform: 'uppercase' }}>
                  ✕ Eskiden (Excel)
                </div>
                {[
                  'Dağınık dosyalar, versiyon karmaşası',
                  'Manuel veri girişi & hatalar',
                  'E-posta zinciriyle onay süreçleri',
                  'Gerçek zamanlı görünürlük yok',
                  'Raporlama için saatler harcanıyor',
                  'Yetkisiz erişim riski',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <XCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: 'rgba(240,240,255,0.55)', fontSize: 14 }}>{item}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
            {/* After */}
            <FadeIn delay={0.1}>
              <div style={{
                background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 20, padding: '32px 28px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 20, letterSpacing: 1, textTransform: 'uppercase' }}>
                  ✓ LogiOps ile
                </div>
                {[
                  'Merkezi, düzenli dijital arşiv',
                  'Otomatik veri akışı & doğrulama',
                  'Dijital onay workflow\'ları',
                  'Gerçek zamanlı dashboard ve izleme',
                  'Anlık raporlama ve analiz',
                  'Rol bazlı güvenli erişim kontrolü',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <CheckCircle2 size={15} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: 'rgba(240,240,255,0.75)', fontSize: 14 }}>{item}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Case studies */}
      {cases.map((c, ci) => (
        <section key={c.company} style={{ padding: '80px 0', background: ci % 2 === 1 ? 'rgba(5,5,15,0.5)' : 'transparent' }}>
          <div className="container">
            <FadeIn>
              <div style={{ marginBottom: 40 }}>
                <div className="section-label" style={{
                  background: `${c.color}12`,
                  border: `1px solid ${c.color}30`,
                  color: c.color,
                }}>
                  {c.industry}
                </div>
                <h2 style={{
                  fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 800, color: '#f0f0ff',
                  letterSpacing: '-0.5px', fontFamily: "'Space Grotesk', sans-serif", marginTop: 12,
                }}>
                  {c.company}
                </h2>
              </div>
            </FadeIn>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <FadeIn delay={0}>
                <div className="glass" style={{ padding: '28px 26px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Sorun</div>
                  <p style={{ color: 'rgba(240,240,255,0.6)', fontSize: 15, lineHeight: 1.7 }}>{c.challenge}</p>
                </div>
              </FadeIn>
              <FadeIn delay={0.1}>
                <div className="glass" style={{ padding: '28px 26px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Çözüm</div>
                  <p style={{ color: 'rgba(240,240,255,0.6)', fontSize: 15, lineHeight: 1.7 }}>{c.solution}</p>
                </div>
              </FadeIn>
            </div>

            {/* Results */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
              {c.results.map((r, i) => (
                <FadeIn key={r.label} delay={i * 0.1}>
                  <div className="glass" style={{ padding: '28px 24px', textAlign: 'center' }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, margin: '0 auto 16px',
                      background: `${c.color}15`, border: `1px solid ${c.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <r.icon size={18} color={c.color} />
                    </div>
                    <div style={{
                      fontSize: 30, fontWeight: 800, color: c.color,
                      fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6,
                    }}>{r.value}</div>
                    <div style={{ color: 'rgba(240,240,255,0.5)', fontSize: 13 }}>{r.label}</div>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Timeline */}
            <FadeIn delay={0.2}>
              <div className="glass" style={{ padding: '32px 28px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(240,240,255,0.7)', marginBottom: 24, letterSpacing: 0.5 }}>
                  Uygulama Süreci
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                  {c.timeline.map((t, ti) => (
                    <div key={t.phase} style={{ position: 'relative' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: `${c.color}20`, border: `1px solid ${c.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: c.color,
                        marginBottom: 10,
                      }}>
                        {ti + 1}
                      </div>
                      <div style={{ color: '#f0f0ff', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t.phase}</div>
                      <div style={{ color: c.color, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>{t.duration}</div>
                      <div style={{ color: 'rgba(240,240,255,0.45)', fontSize: 12, lineHeight: 1.6 }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <FadeIn>
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 24, padding: '64px 48px', textAlign: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 400, height: 300, background: 'radial-gradient(ellipse, rgba(99,102,241,0.15), transparent 70%)' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="section-label" style={{ marginBottom: 24 }}><Zap size={13} /> Siz de Dönüştürün</div>
                <h2 style={{
                  fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, color: '#f0f0ff',
                  marginBottom: 16, fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  Şirketinizin Başarı Hikayesini<br />
                  <span className="gradient-text">Birlikte Yazalım</span>
                </h2>
                <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 17, marginBottom: 36 }}>
                  Nexuva ekibiyle ücretsiz bir keşif görüşmesi planlayın.
                </p>
                <Link to="/iletisim" style={{ textDecoration: 'none' }}>
                  <button className="btn-primary" style={{ padding: '14px 32px', fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Demo Talep Et <ArrowRight size={16} /></span>
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
