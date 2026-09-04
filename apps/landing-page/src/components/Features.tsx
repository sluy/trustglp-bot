import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';
import { Activity, TrendingUp, Users, Wallet, Globe, BarChart3, Cpu } from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
};

export default function Features() {
  const { t } = useLanguage();

  const features = [
    { icon: Activity, titleKey: 'feat.1.title', descKey: 'feat.1.desc', color: 'var(--j-green)' },
    { icon: TrendingUp, titleKey: 'feat.2.title', descKey: 'feat.2.desc', color: 'var(--j-cyan)' },
    { icon: Users, titleKey: 'feat.3.title', descKey: 'feat.3.desc', color: 'var(--j-violet)' },
    { icon: Wallet, titleKey: 'feat.4.title', descKey: 'feat.4.desc', color: 'var(--j-green)' },
    { icon: Globe, titleKey: 'feat.5.title', descKey: 'feat.5.desc', color: 'var(--j-cyan)' },
    { icon: BarChart3, titleKey: 'feat.6.title', descKey: 'feat.6.desc', color: 'var(--j-violet)' },
  ];

  return (
    <section className="section" id="features" style={{ position: 'relative' }}>
      <div className="orb orb-cyan" style={{ width: 500, height: 500, bottom: '5%', left: '-10%' }} />

      <div className="container">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="section-label">
            <Cpu size={14} />
            {t('features.label')}
          </span>
          <h2 className="section-title">{t('features.title')}</h2>
          <p className="section-subtitle" style={{ margin: '0 auto' }}>{t('features.subtitle')}</p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
          {features.map((f, i) => (
            <motion.div
              key={f.titleKey}
              {...fadeUp}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="jarvis-card"
              style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: `${f.color}10`, border: `1px solid ${f.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <f.icon size={24} style={{ color: f.color }} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                  {t(f.titleKey)}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--j-text-dim)', lineHeight: 1.7 }}>
                  {t(f.descKey)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
