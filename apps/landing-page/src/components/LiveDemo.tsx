import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';
import { Play, Users, TrendingUp, Wallet, ArrowRight, Eye } from 'lucide-react';
import { getDemoUrl } from '../config';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
};

export default function LiveDemo() {
  const { t } = useLanguage();

  const demos = [
    {
      title: 'Starter',
      desc: t('demo.starter.desc'),
      icon: Users,
      color: 'var(--j-cyan)',
      link: getDemoUrl('starter'),
      features: [t('pricing.t1.f1'), t('pricing.t1.f2'), t('pricing.t1.f4')],
    },
    {
      title: 'Growth',
      desc: t('demo.growth.desc'),
      icon: TrendingUp,
      color: 'var(--j-green)',
      link: getDemoUrl('growth'),
      features: [t('pricing.t2.f2'), t('pricing.t2.f3'), t('pricing.t2.f5')],
    },
    {
      title: 'Enterprise',
      desc: t('demo.enterprise.desc'),
      icon: Wallet,
      color: 'var(--j-violet)',
      link: getDemoUrl('enterprise'),
      features: [t('pricing.t3.f2'), t('pricing.t3.f3'), t('pricing.t3.f4')],
    },
  ];

  return (
    <section className="section" id="demos" style={{ position: 'relative' }}>
      <div className="orb orb-cyan" style={{ width: 400, height: 400, top: '20%', left: '-10%' }} />

      <div className="container">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="section-label">
            <Eye size={14} />
            DEMOS INTERACTIVAS
          </span>
          <h2 className="section-title">
            {t('hero.cta1')}
          </h2>
          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            {t('pricing.subtitle')}
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {demos.map((demo, i) => (
            <motion.div
              key={demo.title}
              {...fadeUp}
              transition={{ duration: 0.6, delay: i * 0.15 }}
            >
              <a
                href={demo.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div
                  className="jarvis-card"
                  style={{
                    cursor: 'pointer',
                    height: '100%',
                    transition: 'all 0.4s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${demo.color}`;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${demo.color}20`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--j-border)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: `${demo.color}10`, border: `1px solid ${demo.color}25`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <demo.icon size={22} style={{ color: demo.color }} />
                    </div>
                    <div className="jarvis-badge" style={{
                      color: demo.color,
                      background: `${demo.color}10`,
                      borderColor: `${demo.color}25`,
                    }}>
                      <Play size={10} />
                      DEMO
                    </div>
                  </div>

                  <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                    {demo.title}
                  </h3>
                  <p style={{ fontSize: 14, color: 'var(--j-text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
                    {demo.desc}
                  </p>

                  {/* Features preview */}
                  <ul style={{ marginBottom: 24 }}>
                    {demo.features.map((f, fi) => (
                      <li key={fi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: 'var(--j-text-dim)' }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: demo.color, flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 14, fontWeight: 700, color: demo.color,
                  }}>
                    {t('pricing.cta')}
                    <ArrowRight size={16} />
                  </div>
                </div>
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
