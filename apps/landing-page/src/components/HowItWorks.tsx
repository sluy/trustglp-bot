import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';
import { Link2, Settings, Zap, ArrowRight } from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
};

export default function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    { icon: Link2, num: '01', titleKey: 'how.s1.title', descKey: 'how.s1.desc', color: 'var(--j-green)' },
    { icon: Settings, num: '02', titleKey: 'how.s2.title', descKey: 'how.s2.desc', color: 'var(--j-cyan)' },
    { icon: Zap, num: '03', titleKey: 'how.s3.title', descKey: 'how.s3.desc', color: 'var(--j-violet)' },
  ];

  return (
    <section className="section" id="how" style={{ position: 'relative' }}>
      <div className="orb orb-violet" style={{ width: 500, height: 500, top: '20%', right: '-10%' }} />

      <div className="container">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} style={{ textAlign: 'center', marginBottom: 80 }}>
          <span className="section-label">
            <Zap size={14} />
            {t('how.label')}
          </span>
          <h2 className="section-title">{t('how.title')}</h2>
          <p className="section-subtitle" style={{ margin: '0 auto' }}>{t('how.subtitle')}</p>
        </motion.div>

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              {...fadeUp}
              transition={{ duration: 0.6, delay: i * 0.2 }}
              style={{ flex: '1 1 300px', maxWidth: 380, position: 'relative' }}
            >
              <div className="jarvis-card" style={{ textAlign: 'center', padding: '48px 32px', height: '100%' }}>
                {/* Step number */}
                <div style={{
                  fontSize: 64, fontWeight: 900, fontFamily: 'var(--font-mono)',
                  color: `${s.color}15`, lineHeight: 1,
                  position: 'absolute', top: 16, right: 24,
                }}>
                  {s.num}
                </div>

                {/* Icon */}
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: `${s.color}10`, border: `1px solid ${s.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 24px',
                }}>
                  <s.icon size={28} style={{ color: s.color }} />
                </div>

                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
                  {t(s.titleKey)}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--j-text-dim)', lineHeight: 1.7 }}>
                  {t(s.descKey)}
                </p>
              </div>

              {/* Connector arrow */}
              {i < steps.length - 1 && (
                <div className="step-connector" style={{
                  position: 'absolute', top: '50%', right: -24,
                  transform: 'translateY(-50%)',
                  color: 'var(--j-border)',
                }}>
                  <ArrowRight size={24} />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @media(max-width:960px){
          .step-connector{display:none!important}
        }
      `}</style>
    </section>
  );
}
