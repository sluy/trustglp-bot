import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';
import { ArrowRight, Calendar, Zap, Shield, Clock, Globe } from 'lucide-react';
import { CALENDLY_URL } from '../config';

const terminalLines = [
  'hero.terminal1',
  'hero.terminal2',
  'hero.terminal3',
  'hero.terminal4',
  'hero.terminal5',
  'hero.terminal6',
];

export default function Hero() {
  const { t } = useLanguage();
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleLines(prev => {
        if (prev >= terminalLines.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { value: '50+', label: t('hero.stat1'), icon: Shield },
    { value: '18K+', label: t('hero.stat2'), icon: Zap },
    { value: '99.9%', label: t('hero.stat3'), icon: Clock },
    { value: '2', label: t('hero.stat4'), icon: Globe },
  ];

  return (
    <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 100, paddingBottom: 80, overflow: 'hidden' }}>
      {/* Background effects */}
      <div className="jarvis-grid-bg" style={{ position: 'absolute', inset: 0 }} />
      <div className="orb orb-green" style={{ width: 700, height: 700, top: '-20%', left: '-15%' }} />
      <div className="orb orb-cyan" style={{ width: 500, height: 500, bottom: '-10%', right: '-10%' }} />
      <div className="orb orb-violet" style={{ width: 400, height: 400, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />

      <div className="container" style={{ position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 60, alignItems: 'center' }}>
          {/* Content */}
          <div style={{ textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="jarvis-badge jarvis-badge-green" style={{ marginBottom: 24, display: 'inline-flex' }}>
                <span className="pulse-green" style={{ width: 6, height: 6 }} />
                {t('hero.badge')}
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              style={{ fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 24, color: '#fff' }}
            >
              {t('hero.title1')}{' '}
              <br />
              <span className="gradient-text-green" style={{ display: 'inline-block' }}>
                {t('hero.title2')}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              style={{ fontSize: 18, color: 'var(--j-text-dim)', lineHeight: 1.7, maxWidth: 640, margin: '0 auto 40px' }}
            >
              {t('hero.subtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}
            >
              <a href="#pricing" className="jarvis-btn-primary" style={{ textDecoration: 'none' }}>
                {t('hero.cta1')}
                <ArrowRight size={16} />
              </a>
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="jarvis-btn-secondary" style={{ textDecoration: 'none' }}>
                <Calendar size={16} />
                {t('hero.cta2')}
              </a>
            </motion.div>
          </div>

          {/* Terminal */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}
          >
            <div style={{
              background: 'rgba(6,6,17,0.9)',
              border: '1px solid rgba(0,255,65,0.15)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 0 40px rgba(0,255,65,0.06), 0 20px 60px rgba(0,0,0,0.5)',
            }}>
              {/* Terminal header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 20px',
                background: 'rgba(0,255,65,0.04)',
                borderBottom: '1px solid rgba(0,255,65,0.08)',
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff3b30' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffcc00' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#00ff41' }} />
                <span style={{ marginLeft: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--j-text-muted)' }}>
                  jarvisp2p@system:~
                </span>
              </div>

              {/* Terminal body */}
              <div style={{ padding: '20px 24px', minHeight: 200 }}>
                {terminalLines.slice(0, visibleLines).map((key, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      color: key.includes('✓') || key.includes('AUTOMÁTICO') || key.includes('AUTOMATIC')
                        ? 'var(--j-green)'
                        : 'var(--j-text-dim)',
                      marginBottom: 8,
                      lineHeight: 1.6,
                    }}
                  >
                    {t(key)}
                  </motion.div>
                ))}
                {visibleLines < terminalLines.length && (
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--j-green)', fontSize: 13 }}>
                    █<span className="anim-blink">_</span>
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, maxWidth: 700, margin: '0 auto', width: '100%' }}
          >
            {stats.map((s, i) => (
              <div key={i} style={{
                textAlign: 'center', padding: 20,
                background: 'var(--j-surface)',
                border: '1px solid var(--j-border)',
                borderRadius: 12,
              }}>
                <s.icon size={18} style={{ color: 'var(--j-green)', marginBottom: 8 }} />
                <p style={{ fontSize: 24, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-mono)' }}>{s.value}</p>
                <p style={{ fontSize: 11, color: 'var(--j-text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <style>{`
        @media(max-width:640px){
          .container > div > div:last-child { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </section>
  );
}
