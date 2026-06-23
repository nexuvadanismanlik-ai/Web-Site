import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Mail, Phone, User, Building2, MessageSquare, Send, CheckCircle2, Zap } from 'lucide-react'

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

function InputField({ icon: Icon, label, type = 'text', placeholder, value, onChange, multiline = false }) {
  const [focused, setFocused] = useState(false)
  const style = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${focused ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 10, padding: '12px 16px 12px 44px',
    color: '#f0f0ff', fontSize: 15, outline: 'none',
    transition: 'border 0.2s',
    boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
    resize: multiline ? 'vertical' : 'none',
    minHeight: multiline ? 130 : 'auto',
    fontFamily: 'Inter, sans-serif',
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', color: 'rgba(240,240,255,0.6)', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 14, top: multiline ? 14 : '50%', transform: multiline ? 'none' : 'translateY(-50%)', color: focused ? '#818cf8' : 'rgba(240,240,255,0.3)', transition: 'color 0.2s' }}>
          <Icon size={16} />
        </div>
        {multiline ? (
          <textarea
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={style}
          />
        ) : (
          <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={style}
          />
        )}
      </div>
    </div>
  )
}

export default function Contact() {
  const [form, setForm] = useState({ name: '', company: '', email: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = e => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 1500)
  }

  return (
    <div style={{ paddingTop: 70 }}>
      {/* Hero */}
      <section style={{ position: 'relative', padding: '100px 0 70px', overflow: 'hidden' }}>
        <div className="mesh-bg">
          <div className="mesh-orb" style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', top: -100, left: -100 }} />
          <div className="mesh-orb" style={{ width: 400, height: 400, background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)', bottom: -50, right: -50, animationDelay: '-4s' }} />
        </div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div className="section-label">İletişim</div>
            <h1 style={{
              fontSize: 'clamp(36px, 5vw, 62px)', fontWeight: 800, lineHeight: 1.1,
              letterSpacing: '-2px', color: '#f0f0ff', marginBottom: 20,
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Hadi <span className="gradient-text">Konuşalım</span>
            </h1>
            <p style={{ color: 'rgba(240,240,255,0.55)', fontSize: 17, lineHeight: 1.7 }}>
              Demo talep edin, sorularınızı sorun veya birlikte çalışmak için ilk adımı atın.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main */}
      <section style={{ padding: '40px 0 100px', background: 'rgba(5,5,15,0.4)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 48, maxWidth: 1000, margin: '0 auto', alignItems: 'start' }}>
            {/* Contact info */}
            <FadeIn>
              <div>
                <h2 style={{ color: '#f0f0ff', fontSize: 26, fontWeight: 700, marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>
                  Bize Ulaşın
                </h2>
                <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 15, lineHeight: 1.7, marginBottom: 36 }}>
                  Ekibimiz demo planlamak ve sorularınızı yanıtlamak için hazır.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
                  {[
                    { icon: User, label: 'İletişim Kişisi', value: 'Arda Sarısaç' },
                    { icon: Phone, label: 'Telefon', value: '0535 529 5700', href: 'tel:+905355295700' },
                    { icon: Mail, label: 'E-posta', value: 'nexuvadanismanlik@gmail.com', href: 'mailto:nexuvadanismanlik@gmail.com' },
                  ].map(item => (
                    <div key={item.label} className="glass" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <item.icon size={18} color="#818cf8" />
                      </div>
                      <div>
                        <div style={{ color: 'rgba(240,240,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
                        {item.href ? (
                          <a href={item.href} style={{ color: '#f0f0ff', fontSize: 15, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
                            onMouseEnter={e => e.target.style.color = '#818cf8'}
                            onMouseLeave={e => e.target.style.color = '#f0f0ff'}>
                            {item.value}
                          </a>
                        ) : (
                          <span style={{ color: '#f0f0ff', fontSize: 15, fontWeight: 500 }}>{item.value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* LogiOps promo */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(99,102,241,0.08))',
                  border: '1px solid rgba(168,85,247,0.2)',
                  borderRadius: 16, padding: '24px 22px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Zap size={15} color="white" />
                    </div>
                    <span style={{ color: '#c084fc', fontSize: 13, fontWeight: 600 }}>LogiOps Demo</span>
                  </div>
                  <p style={{ color: 'rgba(240,240,255,0.55)', fontSize: 14, lineHeight: 1.65 }}>
                    Canlı demo talep edin, ekibimiz size özel bir demo oturumu düzenlesin.
                  </p>
                </div>
              </div>
            </FadeIn>

            {/* Form */}
            <FadeIn delay={0.15}>
              <div className="glass" style={{ padding: '40px 36px', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: -60, right: -60, width: 200, height: 200,
                  background: 'radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)',
                }} />
                {submitted ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                      style={{
                        width: 64, height: 64, borderRadius: '50%', margin: '0 auto 24px',
                        background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <CheckCircle2 size={28} color="#22c55e" />
                    </motion.div>
                    <h3 style={{ color: '#f0f0ff', fontSize: 22, fontWeight: 700, marginBottom: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
                      Mesajınız Alındı!
                    </h3>
                    <p style={{ color: 'rgba(240,240,255,0.5)', fontSize: 15, lineHeight: 1.65 }}>
                      Ekibimiz en kısa sürede sizinle iletişime geçecek.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <h3 style={{ color: '#f0f0ff', fontSize: 20, fontWeight: 700, marginBottom: 28, fontFamily: "'Space Grotesk', sans-serif" }}>
                      Demo Talep Formu
                    </h3>
                    <InputField icon={User} label="Ad Soyad *" placeholder="Adınız Soyadınız" value={form.name} onChange={handleChange('name')} />
                    <InputField icon={Building2} label="Şirket" placeholder="Şirket Adı" value={form.company} onChange={handleChange('company')} />
                    <InputField icon={Mail} label="E-posta *" type="email" placeholder="email@sirket.com" value={form.email} onChange={handleChange('email')} />
                    <InputField icon={MessageSquare} label="Mesaj *" placeholder="Operasyonlarınız ve beklentileriniz hakkında kısaca bilgi verin..." value={form.message} onChange={handleChange('message')} multiline />

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                      style={{
                        width: '100%', padding: '14px', fontSize: 16, marginTop: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {loading ? 'Gönderiliyor...' : (<>Demo Talep Et <Send size={16} /></>)}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>
    </div>
  )
}
