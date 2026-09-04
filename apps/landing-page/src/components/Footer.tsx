import { useLanguage } from '../i18n/LanguageContext';
import { Terminal, Mail, MessageCircle } from 'lucide-react';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer style={{
      borderTop: '1px solid rgba(0,255,65,0.06)',
      padding: '60px 0 40px',
      position: 'relative',
    }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 48, marginBottom: 48 }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Terminal size={18} style={{ color: 'var(--j-green)' }} />
              </div>
              <span style={{
                fontSize: 16, fontWeight: 900, letterSpacing: '0.06em',
                background: 'linear-gradient(135deg, #00ff41, #00d4ff)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                JARVISP2P
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--j-text-muted)', lineHeight: 1.7, maxWidth: 280 }}>
              {t('footer.desc')}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--j-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
              {t('footer.product')}
            </h4>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: t('nav.features'), href: '#features' },
                { label: t('nav.pricing'), href: '#pricing' },
                { label: t('nav.demos'), href: '#demos' },
                { label: t('nav.faq'), href: '#faq' },
              ].map(l => (
                <li key={l.href}>
                  <a href={l.href} style={{ fontSize: 14, color: 'var(--j-text-muted)', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--j-green)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--j-text-muted)')}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--j-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
              {t('footer.legal')}
            </h4>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li>
                <a href="#" style={{ fontSize: 14, color: 'var(--j-text-muted)', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--j-green)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--j-text-muted)')}
                >
                  {t('footer.privacy')}
                </a>
              </li>
              <li>
                <a href="#" style={{ fontSize: 14, color: 'var(--j-text-muted)', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--j-green)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--j-text-muted)')}
                >
                  {t('footer.terms')}
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--j-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
              Contact
            </h4>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={14} style={{ color: 'var(--j-text-muted)' }} />
                <a href="mailto:info@jarvisp2p.com" style={{ fontSize: 14, color: 'var(--j-text-muted)', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--j-green)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--j-text-muted)')}
                >
                  info@jarvisp2p.com
                </a>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageCircle size={14} style={{ color: 'var(--j-text-muted)' }} />
                <a href="https://t.me/jarvisp2p" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--j-text-muted)', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--j-green)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--j-text-muted)')}
                >
                  Telegram
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          borderTop: '1px solid var(--j-border)',
          paddingTop: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <p style={{ fontSize: 12, color: 'var(--j-text-muted)', fontFamily: 'var(--font-mono)' }}>
            © {new Date().getFullYear()} JarvisP2P. {t('footer.rights')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="pulse-green" style={{ width: 6, height: 6 }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--j-green)', letterSpacing: '0.1em' }}>
              SYSTEM OPERATIONAL
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
