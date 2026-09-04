import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';
import { CheckCircle2, Sparkles, ArrowRight, Layers } from 'lucide-react';
import { CALENDLY_URL, getDemoUrl } from '../config';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
};

export default function PricingTiers() {
  const { t } = useLanguage();

  const tiers = [
    {
      id: 'starter',
      nameKey: 'pricing.t1.name',
      descKey: 'pricing.t1.desc',
      priceKey: 'pricing.t1.price',
      features: ['pricing.t1.f1', 'pricing.t1.f2', 'pricing.t1.f3', 'pricing.t1.f4', 'pricing.t1.f5', 'pricing.t1.f6'],
      color: 'var(--j-cyan)',
      popular: false,
      demo: getDemoUrl('starter'),
    },
    {
      id: 'growth',
      nameKey: 'pricing.t2.name',
      descKey: 'pricing.t2.desc',
      priceKey: 'pricing.t2.price',
      features: ['pricing.t2.f1', 'pricing.t2.f2', 'pricing.t2.f3', 'pricing.t2.f4', 'pricing.t2.f5', 'pricing.t2.f6', 'pricing.t2.f7'],
      color: 'var(--j-green)',
      popular: true,
      demo: getDemoUrl('growth'),
    },
    {
      id: 'enterprise',
      nameKey: 'pricing.t3.name',
      descKey: 'pricing.t3.desc',
      priceKey: 'pricing.t3.price',
      features: ['pricing.t3.f1', 'pricing.t3.f2', 'pricing.t3.f3', 'pricing.t3.f4', 'pricing.t3.f5', 'pricing.t3.f6', 'pricing.t3.f7', 'pricing.t3.f8'],
      color: 'var(--j-violet)',
      popular: false,
      demo: getDemoUrl('enterprise'),
    },
  ];

  return (
    <section className="section" id="pricing" style={{ position: 'relative' }}>
      <div className="orb orb-green" style={{ width: 600, height: 600, top: '30%', left: '-15%' }} />
      <div className="orb orb-cyan" style={{ width: 400, height: 400, bottom: '10%', right: '-10%' }} />

      <div className="container">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="section-label">
            <Layers size={14} />
            {t('pricing.label')}
          </span>
          <h2 className="section-title">{t('pricing.title')}</h2>
          <p className="section-subtitle" style={{ margin: '0 auto' }}>{t('pricing.subtitle')}</p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch' }}>
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.id}
              {...fadeUp}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className={`jarvis-card pricing-card ${tier.popular ? 'jarvis-card-highlight' : ''}`}
              style={{
                padding: '40px 32px',
                display: 'flex',
                flexDirection: 'column',
                borderColor: tier.popular ? 'rgba(0,255,65,0.3)' : undefined,
              }}
            >
              {tier.popular && (
                <div className="pricing-popular">{t('pricing.popular')}</div>
              )}

              {/* Header */}
              <div style={{ marginBottom: 24 }}>
                <div className="jarvis-badge" style={{
                  color: tier.color,
                  background: `${tier.color}10`,
                  borderColor: `${tier.color}25`,
                  marginBottom: 16,
                }}>
                  <Sparkles size={12} />
                  {t(tier.nameKey)}
                </div>
                <p style={{ fontSize: 14, color: 'var(--j-text-dim)', lineHeight: 1.6, minHeight: 44 }}>
                  {t(tier.descKey)}
                </p>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 32 }}>
                <span style={{ fontSize: 48, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                  {t(tier.priceKey)}
                </span>
                <span style={{ fontSize: 16, color: 'var(--j-text-muted)', marginLeft: 4 }}>
                  {t('pricing.mo')}
                </span>
              </div>

              {/* Features */}
              <ul style={{ flex: 1, marginBottom: 32 }}>
                {tier.features.map(fKey => (
                  <li key={fKey} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                    <CheckCircle2 size={16} style={{ color: tier.color, flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 14, color: 'var(--j-text-dim)', lineHeight: 1.5 }}>
                      {t(fKey)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <a
                  href={tier.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={tier.popular ? 'jarvis-btn-primary' : 'jarvis-btn-secondary'}
                  style={{ textDecoration: 'none', textAlign: 'center' }}
                >
                  {t('pricing.cta')}
                  <ArrowRight size={16} />
                </a>
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--j-text-muted)',
                    textDecoration: 'none',
                    padding: '8px 0',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--j-text-dim)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--j-text-muted)')}
                >
                  {t('pricing.cta2')} →
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
