import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'Ana Sayfa', path: '/' },
  { label: 'Hakkımızda', path: '/hakkimizda' },
  { label: 'Hizmetler', path: '/hizmetler' },
  { label: 'LogiOps', path: '/logiops' },
  { label: 'Referanslar', path: '/referanslar' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location])

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: '0 24px',
          transition: 'all 0.3s ease',
          background: scrolled
            ? 'rgba(5,5,10,0.85)'
            : 'transparent',
          backdropFilter: scrolled ? 'blur(24px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 70,
        }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <img
              src="/assets/logo/nexuva-logo.svg"
              alt="Nexuva"
              style={{ height: 38, width: 'auto', filter: 'drop-shadow(0 0 10px rgba(37,99,235,0.4))' }}
            />
          </Link>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="desktop-nav">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  textDecoration: 'none',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  color: location.pathname === link.path ? '#60a5fa' : 'rgba(240,240,255,0.7)',
                  background: location.pathname === link.path ? 'rgba(37,99,235,0.12)' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  if (location.pathname !== link.path) {
                    e.target.style.color = 'rgba(240,240,255,0.95)'
                    e.target.style.background = 'rgba(255,255,255,0.05)'
                  }
                }}
                onMouseLeave={e => {
                  if (location.pathname !== link.path) {
                    e.target.style.color = 'rgba(240,240,255,0.7)'
                    e.target.style.background = 'transparent'
                  }
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/iletisim" style={{ display: 'flex' }}>
              <button className="btn-primary" style={{ padding: '9px 20px', fontSize: 14 }}>
                <span>Demo Talep Et</span>
              </button>
            </Link>
            <button
              onClick={() => setMobileOpen(o => !o)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: 'white',
                cursor: 'pointer',
                padding: '7px',
                display: 'flex',
                alignItems: 'center',
              }}
              className="mobile-menu-btn"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              top: 70,
              left: 0,
              right: 0,
              zIndex: 999,
              background: 'rgba(5,5,10,0.97)',
              backdropFilter: 'blur(24px)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              padding: '16px 24px 24px',
            }}
          >
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  padding: '13px 16px',
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 500,
                  color: location.pathname === link.path ? '#60a5fa' : 'rgba(240,240,255,0.8)',
                  background: location.pathname === link.path ? 'rgba(99,102,241,0.1)' : 'transparent',
                  marginBottom: 4,
                }}
              >
                {link.label}
              </Link>
            ))}
            <Link to="/iletisim" style={{ display: 'block', marginTop: 12 }}>
              <button className="btn-primary" style={{ width: '100%', padding: '13px' }}>
                <span>Demo Talep Et</span>
              </button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (min-width: 769px) { .mobile-menu-btn { display: none !important; } }
        @media (max-width: 768px) { .desktop-nav { display: none !important; } }
      `}</style>
    </>
  )
}
