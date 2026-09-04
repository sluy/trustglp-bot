import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';
import { Rocket, ArrowRight } from 'lucide-react';
import { CALENDLY_URL } from '../config';

export default function CTASection() {
  const { t } = useLanguage();

  return (
    <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(0,255,65,0.06) 0%, rgba(0,212,255,0.04) 50%, rgba(139,92,246,0.04) 100%)',
            border: '1px solid rgba(0,255,65,0.15)',
            borderRadius: 24,
            padding: '80px 40px',
            textAlign: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Background orbs */}
          <div className="orb orb-green" style={{ width: 300, height: 300, top: '-30%', left: '-10%' }} />
          <div className="orb orb-cyan" style={{ width: 200, height: 200, bottom: '-20%', right: '-5%' }} />

          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: 'rgba(0,255,65,0.1)', border: '1px solid rgba(0,255,65,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <Rocket size={28} style={{ color: 'var(--j-green)' }} />
            </div>

            <h2 style={{
              fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#fff',
              lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.02em',
            }}>
              {t('cta.title')}
            </h2>

            <p style={{
              fontSize: 17, color: 'var(--j-text-dim)', lineHeight: 1.7,
              maxWidth: 540, margin: '0 auto 40px',
            }}>
              {t('cta.subtitle')}
            </p>

            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="jarvis-btn-primary"
              style={{
                textDecoration: 'none',
                fontSize: 16,
                padding: '18px 40px',
              }}
            >
              {t('cta.btn')}
              <ArrowRight size={18} />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
