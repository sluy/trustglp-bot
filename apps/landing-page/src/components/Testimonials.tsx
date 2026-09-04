import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';
import { Star, Quote } from 'lucide-react';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
};

export default function Testimonials() {
  const { t } = useLanguage();

  const testimonials = [
    { textKey: 'test.1.text', nameKey: 'test.1.name', roleKey: 'test.1.role', color: 'var(--j-green)' },
    { textKey: 'test.2.text', nameKey: 'test.2.name', roleKey: 'test.2.role', color: 'var(--j-cyan)' },
    { textKey: 'test.3.text', nameKey: 'test.3.name', roleKey: 'test.3.role', color: 'var(--j-violet)' },
  ];

  return (
    <section className="section" style={{ position: 'relative' }}>
      <div className="orb orb-violet" style={{ width: 400, height: 400, top: '20%', left: '-10%' }} />

      <div className="container">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="section-label">
            <Star size={14} />
            {t('test.label')}
          </span>
          <h2 className="section-title">{t('test.title')}</h2>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {testimonials.map((test, i) => (
            <motion.div
              key={i}
              {...fadeUp}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="jarvis-card"
              style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
            >
              <Quote size={28} style={{ color: `${test.color}`, opacity: 0.3 }} />

              <p style={{ fontSize: 15, color: 'var(--j-text)', lineHeight: 1.8, fontStyle: 'italic', flex: 1 }}>
                {t(test.textKey)}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${test.color}15`, border: `1px solid ${test.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: test.color,
                }}>
                  {t(test.nameKey).charAt(0)}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {t(test.nameKey)}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--j-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {t(test.roleKey)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
