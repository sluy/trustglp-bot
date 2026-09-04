import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';
import { Monitor, Clock, AlertTriangle, BarChart3 } from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6 },
};

export default function ProblemSection() {
  const { t } = useLanguage();

  const problems = [
    { icon: Monitor, key: 'p1', color: '#ff3366' },
    { icon: Clock, key: 'p2', color: '#ffaa00' },
    { icon: AlertTriangle, key: 'p3', color: '#ff6633' },
    { icon: BarChart3, key: 'p4', color: '#ff3366' },
  ];

  return (
    <section className="section" id="problem" style={{ position: 'relative' }}>
      <div className="orb orb-green" style={{ width: 400, height: 400, top: '10%', right: '-15%' }} />

      <div className="container">
        <motion.div {...fadeUp} style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="section-label">
            <AlertTriangle size={14} />
            {t('problem.label')}
          </span>
          <h2 className="section-title">{t('problem.title')}</h2>
          <p className="section-subtitle" style={{ margin: '0 auto' }}>{t('problem.subtitle')}</p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {problems.map((p, i) => (
            <motion.div
              key={p.key}
              {...fadeUp}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="jarvis-card"
              style={{
                borderColor: `${p.color}22`,
                textAlign: 'left',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${p.color}44`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${p.color}15`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${p.color}22`;
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: `${p.color}12`, border: `1px solid ${p.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>
                <p.icon size={22} style={{ color: p.color }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
                {t(`problem.${p.key}.title`)}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--j-text-dim)', lineHeight: 1.7 }}>
                {t(`problem.${p.key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
