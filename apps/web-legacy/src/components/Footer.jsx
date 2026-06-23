import { Link } from 'react-router-dom'
import { Mail, Phone, ArrowUpRight } from 'lucide-react'

const footerLinks = {
  'Şirket': [
    { label: 'Hakkımızda', path: '/hakkimizda' },
    { label: 'Hizmetler', path: '/hizmetler' },
    { label: 'Referanslar', path: '/referanslar' },
    { label: 'İletişim', path: '/iletisim' },
  ],
  'Ürün': [
    { label: 'LogiOps', path: '/logiops' },
    { label: 'Özellikler', path: '/logiops' },
    { label: 'Demo Talep Et', path: '/iletisim' },
  ],
}

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(5,5,10,0.9)',
      padding: '70px 24px 40px',
      marginTop: 'auto',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 48,
          marginBottom: 64,
        }}>
          {/* Brand */}
          <div>
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', marginBottom: 18 }}>
              <img
                src="/assets/logo/nexuva-logo.svg"
                alt="Nexuva"
                style={{ height: 36, width: 'auto', filter: 'drop-shadow(0 0 8px rgba(37,99,235,0.35))' }}
              />
            </Link>
            <p style={{ color: 'rgba(240,240,255,0.45)', fontSize: 14, lineHeight: 1.7, marginBottom: 24, maxWidth: 220 }}>
              Modern şirketler için operasyonel zekâ. Dijital dönüşüm danışmanlığı ve LogiOps SaaS platformu.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="mailto:nexuvadanismanlik@gmail.com" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                color: 'rgba(240,240,255,0.55)', fontSize: 13, textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,240,255,0.55)'}>
                <Mail size={14} /> nexuvadanismanlik@gmail.com
              </a>
              <a href="tel:+905355295700" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                color: 'rgba(240,240,255,0.55)', fontSize: 13, textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,240,255,0.55)'}>
                <Phone size={14} /> 0535 529 5700
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <p style={{ color: 'rgba(240,240,255,0.9)', fontWeight: 600, fontSize: 14, marginBottom: 18 }}>
                {section}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {links.map(link => (
                  <Link
                    key={link.label}
                    to={link.path}
                    style={{
                      textDecoration: 'none',
                      color: 'rgba(240,240,255,0.45)',
                      fontSize: 14,
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(240,240,255,0.9)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,240,255,0.45)'}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* LogiOps CTA */}
          <div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(29,78,216,0.15), rgba(8,145,178,0.12))',
              border: '1px solid rgba(37,99,235,0.3)',
              borderRadius: 16,
              padding: 24,
            }}>
              <div style={{ marginBottom: 12 }}>
                <img src="/assets/logo/logiops-logo.svg" alt="LogiOps" style={{ height: 32, width: 'auto' }} />
              </div>
              <p style={{ color: 'rgba(224,242,254,0.5)', fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
                Operasyon yönetimi ve workflow automation platformu.
              </p>
              <Link to="/logiops" style={{ textDecoration: 'none' }}>
                <button style={{
                  background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
                  color: 'white', border: 'none', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  İncele <ArrowUpRight size={14} />
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 28,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <p style={{ color: 'rgba(240,240,255,0.3)', fontSize: 13 }}>
            © {new Date().getFullYear()} Nexuva Danışmanlık. Tüm hakları saklıdır.
          </p>
          <p style={{ color: 'rgba(240,240,255,0.3)', fontSize: 13 }}>
            Arda Sarısaç · nexuvadanismanlik@gmail.com
          </p>
        </div>
      </div>
    </footer>
  )
}
