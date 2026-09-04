import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Terminal, Menu, X } from 'lucide-react';
import { CALENDLY_URL } from '../config';

export default function Navbar() {
  const { lang, setLang, t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { label: t('nav.features'), href: '#features' },
    { label: t('nav.how'), href: '#how' },
    { label: t('nav.pricing'), href: '#pricing' },
    { label: t('nav.demos'), href: '#demos' },
    { label: t('nav.faq'), href: '#faq' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: '0 24px',
        background: scrolled ? 'rgba(6,6,17,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,255,65,0.08)' : '1px solid transparent',
        transition: 'all 0.4s ease',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
        {/* Logo */}
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Terminal style={{ width: 20, height: 20, color: 'var(--j-green)' }} />
          </div>
          <div>
            <span style={{
              fontSize: 18, fontWeight: 900, letterSpacing: '0.08em',
              background: 'linear-gradient(135deg, #00ff41, #00d4ff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              JARVIS<span style={{ fontWeight: 400 }}>P2P</span>
            </span>
            <p style={{ fontSize: 9, color: 'var(--j-text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em' }}>
              P2P AUTOMATION
            </p>
          </div>
        </a>

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="nav-desktop">
          {links.map(l => (
            <a
              key={l.href}
              href={l.href}
              style={{
                fontSize: 13, fontWeight: 600, color: 'var(--j-text-dim)',
                transition: 'color 0.2s', letterSpacing: '0.02em',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--j-green)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--j-text-dim)')}
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Lang toggle */}
          <div className="lang-toggle">
            <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
          </div>

          {/* CTA */}
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="jarvis-btn-primary jarvis-btn-sm nav-cta-desktop"
            style={{ textDecoration: 'none' }}
          >
            {t('nav.cta')}
          </a>

          {/* Mobile hamburger */}
          <button
            className="nav-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ display: 'none', color: 'var(--j-text)', padding: 8 }}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{
          position: 'absolute', top: 72, left: 0, right: 0,
          background: 'rgba(6,6,17,0.95)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,255,65,0.1)',
          padding: '16px 24px',
        }}>
          {links.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              style={{ display: 'block', padding: '12px 0', fontSize: 15, fontWeight: 600, color: 'var(--j-text-dim)' }}
            >
              {l.label}
            </a>
          ))}
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="jarvis-btn-primary"
            style={{ marginTop: 12, width: '100%', textDecoration: 'none' }}
          >
            {t('nav.cta')}
          </a>
        </div>
      )}

      <style>{`
        @media(max-width:768px){
          .nav-desktop{display:none!important}
          .nav-cta-desktop{display:none!important}
          .nav-mobile-toggle{display:flex!important}
        }
      `}</style>
    </nav>
  );
}
