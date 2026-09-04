import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type Language = 'es' | 'en';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  es: {
    // Navbar
    'nav.features': 'Características',
    'nav.how': 'Cómo Funciona',
    'nav.pricing': 'Precios',
    'nav.demos': 'Demos',
    'nav.faq': 'FAQ',
    'nav.cta': 'Agendar Demo',

    // Hero
    'hero.badge': 'Sistema de Automatización P2P',
    'hero.title1': 'Tu Mesa P2P en',
    'hero.title2': 'Piloto Automático',
    'hero.subtitle': 'Gestiona órdenes, domina el libro de precios y automatiza pagos bancarios — 24/7, sin errores humanos. La plataforma que usan los merchants que facturan en serio.',
    'hero.cta1': 'Ver Demos en Vivo',
    'hero.cta2': 'Agendar Llamada',
    'hero.stat1': 'Merchants Activos',
    'hero.stat2': 'Órdenes Procesadas',
    'hero.stat3': 'Uptime',
    'hero.stat4': 'Exchanges',
    'hero.terminal1': '> Conectando con Binance P2P...',
    'hero.terminal2': '> Escaneando libro de órdenes USDT/VES...',
    'hero.terminal3': '> 47 anuncios analizados en 0.3s',
    'hero.terminal4': '> Posición #1 asegurada ✓',
    'hero.terminal5': '> Auto-pay: Pago detectado → Cripto liberada en 8s',
    'hero.terminal6': '> Sistema operativo. Modo: AUTOMÁTICO',

    // Problem
    'problem.label': 'El Problema',
    'problem.title': '¿Reconoces alguno de estos dolores?',
    'problem.subtitle': 'Si operas una mesa P2P manualmente, estás perdiendo dinero y tiempo todos los días.',
    'problem.p1.title': 'Pegado a la pantalla 16h/día',
    'problem.p1.desc': 'No puedes descansar porque si no estás mirando, pierdes órdenes. Tu vida gira alrededor de la pantalla.',
    'problem.p2.title': 'Pierdes trades a las 3am',
    'problem.p2.desc': 'Mientras duermes, tus competidores te roban la primera posición. Despiertas y tu anuncio está en la página 5.',
    'problem.p3.title': 'Errores en pagos manuales',
    'problem.p3.desc': 'Un número mal copiado, un monto equivocado. Los errores humanos en transferencias bancarias te cuestan dinero real.',
    'problem.p4.title': 'Sin visibilidad del ROI',
    'problem.p4.desc': 'No sabes cuánto gana cada operador, cuál es tu spread real, ni si estás perdiendo dinero en ciertas franjas horarias.',

    // Features
    'features.label': 'Características',
    'features.title': 'Todo lo que necesitas para dominar el P2P',
    'features.subtitle': 'Una suite completa de herramientas diseñada por merchants, para merchants.',
    'feat.1.title': 'Monitor en Tiempo Real',
    'feat.1.desc': 'Visualiza todas las órdenes de Binance y Bybit en un solo dashboard. Filtra por exchange, banco, estado y operador.',
    'feat.2.title': 'Pricing Dinámico',
    'feat.2.desc': 'Algoritmo que analiza el Top 5 de competidores y ajusta tu precio automáticamente para mantener la posición #1.',
    'feat.3.title': 'Gestión de Operadores',
    'feat.3.desc': 'Asigna órdenes a tu equipo, trackea tiempos de respuesta y mide el rendimiento de cada operador.',
    'feat.4.title': 'Auto-Pago Bancario',
    'feat.4.desc': 'Detecta pagos entrantes en tu cuenta bancaria y libera la cripto automáticamente. Sin intervención humana.',
    'feat.5.title': 'Multi-Exchange',
    'feat.5.desc': 'Opera simultáneamente en Binance P2P y Bybit P2P desde una sola interfaz unificada.',
    'feat.6.title': 'Analytics y Reportes',
    'feat.6.desc': 'Dashboards con métricas de volumen, spread, tiempo de respuesta, y PnL por operador y por franja horaria.',

    // How it works
    'how.label': 'Cómo Funciona',
    'how.title': 'Operativo en 3 pasos',
    'how.subtitle': 'Configura una vez, opera para siempre.',
    'how.s1.title': 'Conecta',
    'how.s1.desc': 'Ingresa tus API Keys de Binance y/o Bybit. Configura tus métodos de pago (Banesco, Mercantil, Pago Móvil, etc).',
    'how.s2.title': 'Configura',
    'how.s2.desc': 'Define tu margen objetivo, capital disponible, y asigna operadores a tu mesa. El sistema calcula los precios óptimos.',
    'how.s3.title': 'Automatiza',
    'how.s3.desc': 'Activa el modo automático. JarvisP2P trabaja 24/7: publica anuncios, ajusta precios, procesa órdenes y ejecuta pagos.',

    // Pricing
    'pricing.label': 'Planes',
    'pricing.title': 'Elige tu nivel de automatización',
    'pricing.subtitle': 'Cada plan se paga solo con las primeras órdenes del mes. Sin contratos, cancela cuando quieras.',
    'pricing.mo': '/mes',
    'pricing.cta': 'Probar Demo',
    'pricing.cta2': 'Agendar Llamada',
    'pricing.popular': '⚡ Más Popular',

    'pricing.t1.name': 'Starter',
    'pricing.t1.desc': 'Gestión centralizada de órdenes y operadores',
    'pricing.t1.price': '$199',
    'pricing.t1.f1': 'Dashboard de órdenes en tiempo real',
    'pricing.t1.f2': 'Asignación de operadores',
    'pricing.t1.f3': 'Filtro por exchange y banco',
    'pricing.t1.f4': 'Countdown de órdenes activas',
    'pricing.t1.f5': 'Alertas por Telegram',
    'pricing.t1.f6': 'Soporte por email',

    'pricing.t2.name': 'Growth',
    'pricing.t2.desc': 'Domina el libro de precios automáticamente',
    'pricing.t2.price': '$599',
    'pricing.t2.f1': 'Todo lo de Starter',
    'pricing.t2.f2': 'Repricing automático 24/7',
    'pricing.t2.f3': 'Análisis de competencia en vivo',
    'pricing.t2.f4': 'ON/OFF de anuncios por inventario',
    'pricing.t2.f5': 'Estrategia de posición #1',
    'pricing.t2.f6': 'Multi-exchange simultáneo',
    'pricing.t2.f7': 'Soporte prioritario',

    'pricing.t3.name': 'Enterprise',
    'pricing.t3.desc': 'Automatización total: órdenes, precios y pagos',
    'pricing.t3.price': '$2,000',
    'pricing.t3.f1': 'Todo lo de Growth',
    'pricing.t3.f2': 'Auto-detección de pagos bancarios',
    'pricing.t3.f3': 'Liberación automática de cripto',
    'pricing.t3.f4': 'Conciliación bancaria inteligente',
    'pricing.t3.f5': 'Integración bancaria dedicada',
    'pricing.t3.f6': 'Onboarding personalizado',
    'pricing.t3.f7': 'Soporte 24/7 + Slack dedicado',
    'pricing.t3.f8': 'SLA de 99.9% uptime',

    // Testimonials
    'test.label': 'Testimonios',
    'test.title': 'Lo que dicen nuestros merchants',
    'test.1.text': '"Antes pasaba 14 horas frente a la pantalla. Ahora el sistema opera solo mientras yo duermo. Mi volumen subió 3x en el primer mes."',
    'test.1.name': 'Carlos M.',
    'test.1.role': 'Merchant Binance P2P · Venezuela',
    'test.2.text': '"El repricing automático es brutal. Siempre estoy en posición #1 sin tener que mover un dedo. Recuperé la inversión en 5 días."',
    'test.2.name': 'Andrea R.',
    'test.2.role': 'Mesa OTC · Colombia',
    'test.3.text': '"El autopay cambió el juego completamente. Procesa pagos en 8 segundos. Mis clientes están felices y yo también."',
    'test.3.name': 'Miguel S.',
    'test.3.role': 'Remesadora Digital · Argentina',

    // FAQ
    'faq.label': 'Preguntas Frecuentes',
    'faq.title': 'Respuestas directas',
    'faq.q1': '¿Es seguro conectar mis API Keys de Binance/Bybit?',
    'faq.a1': 'Absolutamente. Tus API Keys se almacenan con encriptación AES-256 y nunca tienen permisos de retiro. Solo usamos permisos de lectura y P2P trading, que no permiten mover fondos fuera del exchange.',
    'faq.q2': '¿Funciona con Binance y Bybit al mismo tiempo?',
    'faq.a2': 'Sí. JarvisP2P opera simultáneamente en ambos exchanges desde un solo panel. Puedes ver todas las órdenes unificadas y configurar estrategias de pricing independientes por exchange.',
    'faq.q3': '¿Puedo probarlo antes de pagar?',
    'faq.a3': 'Claro. Tenemos demos interactivas en esta misma página donde puedes experimentar cada plan con datos simulados. Además, ofrecemos una prueba de 7 días del plan Starter.',
    'faq.q4': '¿Qué bancos soportan para pagos automáticos?',
    'faq.a4': 'Actualmente soportamos los principales bancos de Venezuela (Banesco, Mercantil, Provincial, BDV, BOD, Banplus) y Pago Móvil. Estamos expandiendo a bancos de Colombia y Argentina.',
    'faq.q5': '¿Cuántos operadores puedo agregar?',
    'faq.a5': 'No hay límite. Puedes agregar tantos operadores como necesites. El sistema asigna órdenes automáticamente basado en disponibilidad y rendimiento histórico.',
    'faq.q6': '¿Qué pasa si un pago no se detecta automáticamente?',
    'faq.a6': 'El sistema tiene un fallback manual: si después de 60 segundos no detecta el pago, alerta al operador asignado para revisión manual. Nunca se libera cripto sin confirmación.',

    // CTA
    'cta.title': 'Empieza a operar en piloto automático',
    'cta.subtitle': 'Agenda una llamada de 15 minutos. Te mostramos cómo JarvisP2P puede multiplicar tu volumen P2P.',
    'cta.btn': 'Agendar Demo Gratuita',

    // Footer
    'footer.desc': 'Plataforma de automatización para comercio P2P en exchanges de criptomonedas.',
    'footer.product': 'Producto',
    'footer.legal': 'Legal',
    'footer.privacy': 'Política de Privacidad',
    'footer.terms': 'Términos de Servicio',
    'footer.rights': 'Todos los derechos reservados.',

    // Demo
    'demo.back': '← Volver a JarvisP2P',
    'demo.starter.title': 'Demo Starter: Gestión de Órdenes',
    'demo.starter.desc': 'Experimenta el panel de gestión centralizada con órdenes dummy en tiempo real.',
    'demo.growth.title': 'Demo Growth: Anuncios Automáticos',
    'demo.growth.desc': 'Observa cómo el algoritmo de repricing mantiene tu posición #1 automáticamente.',
    'demo.enterprise.title': 'Demo Enterprise: Pagos Automáticos',
    'demo.enterprise.desc': 'Visualiza la conciliación bancaria y liberación automática de cripto.',
    'demo.orders': 'Órdenes',
    'demo.operators': 'Operadores',
    'demo.volume': 'Volumen 24h',
    'demo.completed': 'Completadas',
    'demo.pending': 'Pendientes',
    'demo.assign': 'Asignar',
    'demo.unassigned': 'Sin asignar',
    'demo.all': 'Todos',
    'demo.filter.exchange': 'Exchange',
    'demo.filter.status': 'Estado',
    'demo.position': 'Tu posición',
    'demo.repricing': 'Repricing automático',
    'demo.ads.active': 'Anuncios Activos',
    'demo.ads.position': 'Posición en libro',
    'demo.autopay.detected': 'Pago Detectado',
    'demo.autopay.released': 'Cripto Liberada',
    'demo.autopay.time': 'Tiempo de procesamiento',
    'demo.autopay.feed': 'Feed de Pagos en Tiempo Real',
    'demo.autopay.match': 'Conciliación Automática',
    'demo.autopay.savings': 'Tiempo ahorrado vs manual',
    'demo.upgrade': 'Contratar este Plan',
  },
  en: {
    // Navbar
    'nav.features': 'Features',
    'nav.how': 'How It Works',
    'nav.pricing': 'Pricing',
    'nav.demos': 'Demos',
    'nav.faq': 'FAQ',
    'nav.cta': 'Book a Demo',

    // Hero
    'hero.badge': 'P2P Automation System',
    'hero.title1': 'Your P2P Desk on',
    'hero.title2': 'Autopilot',
    'hero.subtitle': 'Manage orders, dominate the order book and automate bank payments — 24/7, zero human error. The platform used by merchants who mean business.',
    'hero.cta1': 'See Live Demos',
    'hero.cta2': 'Book a Call',
    'hero.stat1': 'Active Merchants',
    'hero.stat2': 'Orders Processed',
    'hero.stat3': 'Uptime',
    'hero.stat4': 'Exchanges',
    'hero.terminal1': '> Connecting to Binance P2P...',
    'hero.terminal2': '> Scanning USDT/VES order book...',
    'hero.terminal3': '> 47 ads analyzed in 0.3s',
    'hero.terminal4': '> Position #1 secured ✓',
    'hero.terminal5': '> Auto-pay: Payment detected → Crypto released in 8s',
    'hero.terminal6': '> System operational. Mode: AUTOMATIC',

    // Problem
    'problem.label': 'The Problem',
    'problem.title': 'Do any of these sound familiar?',
    'problem.subtitle': 'If you run a P2P desk manually, you\'re losing money and time every single day.',
    'problem.p1.title': 'Glued to the screen 16h/day',
    'problem.p1.desc': 'You can\'t rest because if you\'re not watching, you lose orders. Your life revolves around the screen.',
    'problem.p2.title': 'Losing trades at 3am',
    'problem.p2.desc': 'While you sleep, competitors steal your top position. You wake up and your ad is on page 5.',
    'problem.p3.title': 'Manual payment errors',
    'problem.p3.desc': 'A wrong number, a wrong amount. Human errors in bank transfers cost you real money.',
    'problem.p4.title': 'Zero ROI visibility',
    'problem.p4.desc': 'You don\'t know how much each operator earns, your real spread, or if you\'re losing money during certain hours.',

    // Features
    'features.label': 'Features',
    'features.title': 'Everything you need to dominate P2P',
    'features.subtitle': 'A complete suite of tools designed by merchants, for merchants.',
    'feat.1.title': 'Real-Time Monitor',
    'feat.1.desc': 'View all Binance and Bybit orders in a single dashboard. Filter by exchange, bank, status and operator.',
    'feat.2.title': 'Dynamic Pricing',
    'feat.2.desc': 'Algorithm that analyzes the Top 5 competitors and adjusts your price automatically to hold position #1.',
    'feat.3.title': 'Operator Management',
    'feat.3.desc': 'Assign orders to your team, track response times and measure each operator\'s performance.',
    'feat.4.title': 'Auto Bank Payment',
    'feat.4.desc': 'Detects incoming payments in your bank account and releases crypto automatically. Zero human intervention.',
    'feat.5.title': 'Multi-Exchange',
    'feat.5.desc': 'Operate simultaneously on Binance P2P and Bybit P2P from a single unified interface.',
    'feat.6.title': 'Analytics & Reports',
    'feat.6.desc': 'Dashboards with volume metrics, spread, response time, and PnL by operator and time slot.',

    // How it works
    'how.label': 'How It Works',
    'how.title': 'Live in 3 steps',
    'how.subtitle': 'Set up once, operate forever.',
    'how.s1.title': 'Connect',
    'how.s1.desc': 'Enter your Binance and/or Bybit API Keys. Configure your payment methods (bank accounts, mobile pay, etc).',
    'how.s2.title': 'Configure',
    'how.s2.desc': 'Set your target margin, available capital, and assign operators to your desk. The system calculates optimal prices.',
    'how.s3.title': 'Automate',
    'how.s3.desc': 'Activate automatic mode. JarvisP2P works 24/7: posts ads, adjusts prices, processes orders and executes payments.',

    // Pricing
    'pricing.label': 'Plans',
    'pricing.title': 'Choose your automation level',
    'pricing.subtitle': 'Each plan pays for itself with the first orders of the month. No contracts, cancel anytime.',
    'pricing.mo': '/mo',
    'pricing.cta': 'Try Demo',
    'pricing.cta2': 'Book a Call',
    'pricing.popular': '⚡ Most Popular',

    'pricing.t1.name': 'Starter',
    'pricing.t1.desc': 'Centralized order and operator management',
    'pricing.t1.price': '$199',
    'pricing.t1.f1': 'Real-time order dashboard',
    'pricing.t1.f2': 'Operator assignment',
    'pricing.t1.f3': 'Filter by exchange and bank',
    'pricing.t1.f4': 'Active order countdown',
    'pricing.t1.f5': 'Telegram alerts',
    'pricing.t1.f6': 'Email support',

    'pricing.t2.name': 'Growth',
    'pricing.t2.desc': 'Dominate the order book automatically',
    'pricing.t2.price': '$599',
    'pricing.t2.f1': 'Everything in Starter',
    'pricing.t2.f2': '24/7 automatic repricing',
    'pricing.t2.f3': 'Live competition analysis',
    'pricing.t2.f4': 'Ads ON/OFF by inventory',
    'pricing.t2.f5': 'Position #1 strategy',
    'pricing.t2.f6': 'Simultaneous multi-exchange',
    'pricing.t2.f7': 'Priority support',

    'pricing.t3.name': 'Enterprise',
    'pricing.t3.desc': 'Full automation: orders, pricing & payments',
    'pricing.t3.price': '$2,000',
    'pricing.t3.f1': 'Everything in Growth',
    'pricing.t3.f2': 'Auto bank payment detection',
    'pricing.t3.f3': 'Automatic crypto release',
    'pricing.t3.f4': 'Smart bank reconciliation',
    'pricing.t3.f5': 'Dedicated bank integration',
    'pricing.t3.f6': 'Personalized onboarding',
    'pricing.t3.f7': '24/7 support + Dedicated Slack',
    'pricing.t3.f8': '99.9% uptime SLA',

    // Testimonials
    'test.label': 'Testimonials',
    'test.title': 'What our merchants say',
    'test.1.text': '"I used to spend 14 hours staring at the screen. Now the system operates while I sleep. My volume went up 3x in the first month."',
    'test.1.name': 'Carlos M.',
    'test.1.role': 'Binance P2P Merchant · Venezuela',
    'test.2.text': '"Automatic repricing is insane. I\'m always at position #1 without lifting a finger. ROI in 5 days."',
    'test.2.name': 'Andrea R.',
    'test.2.role': 'OTC Desk · Colombia',
    'test.3.text': '"Autopay changed the game completely. It processes payments in 8 seconds. My clients are happy and so am I."',
    'test.3.name': 'Miguel S.',
    'test.3.role': 'Digital Remittance · Argentina',

    // FAQ
    'faq.label': 'Frequently Asked Questions',
    'faq.title': 'Straight answers',
    'faq.q1': 'Is it safe to connect my Binance/Bybit API Keys?',
    'faq.a1': 'Absolutely. Your API Keys are stored with AES-256 encryption and never have withdrawal permissions. We only use read and P2P trading permissions, which cannot move funds off the exchange.',
    'faq.q2': 'Does it work with Binance and Bybit simultaneously?',
    'faq.a2': 'Yes. JarvisP2P operates on both exchanges from a single panel. You can see all orders unified and configure independent pricing strategies per exchange.',
    'faq.q3': 'Can I try it before paying?',
    'faq.a3': 'Of course. We have interactive demos on this page where you can experience each plan with simulated data. Plus, we offer a 7-day trial of the Starter plan.',
    'faq.q4': 'Which banks are supported for automatic payments?',
    'faq.a4': 'We currently support major Venezuelan banks (Banesco, Mercantil, Provincial, BDV, BOD, Banplus) and Pago Móvil. We\'re expanding to Colombia and Argentina banks.',
    'faq.q5': 'How many operators can I add?',
    'faq.a5': 'No limit. Add as many operators as you need. The system automatically assigns orders based on availability and historical performance.',
    'faq.q6': 'What happens if a payment isn\'t detected automatically?',
    'faq.a6': 'The system has a manual fallback: if after 60 seconds it doesn\'t detect the payment, it alerts the assigned operator for manual review. Crypto is never released without confirmation.',

    // CTA
    'cta.title': 'Start operating on autopilot',
    'cta.subtitle': 'Book a 15-minute call. We\'ll show you how JarvisP2P can multiply your P2P volume.',
    'cta.btn': 'Book Free Demo',

    // Footer
    'footer.desc': 'Automation platform for P2P trading on cryptocurrency exchanges.',
    'footer.product': 'Product',
    'footer.legal': 'Legal',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Service',
    'footer.rights': 'All rights reserved.',

    // Demo
    'demo.back': '← Back to JarvisP2P',
    'demo.starter.title': 'Starter Demo: Order Management',
    'demo.starter.desc': 'Experience the centralized management panel with real-time dummy orders.',
    'demo.growth.title': 'Growth Demo: Auto Ads',
    'demo.growth.desc': 'Watch the repricing algorithm maintain your #1 position automatically.',
    'demo.enterprise.title': 'Enterprise Demo: Auto Payments',
    'demo.enterprise.desc': 'Visualize bank reconciliation and automatic crypto release.',
    'demo.orders': 'Orders',
    'demo.operators': 'Operators',
    'demo.volume': '24h Volume',
    'demo.completed': 'Completed',
    'demo.pending': 'Pending',
    'demo.assign': 'Assign',
    'demo.unassigned': 'Unassigned',
    'demo.all': 'All',
    'demo.filter.exchange': 'Exchange',
    'demo.filter.status': 'Status',
    'demo.position': 'Your position',
    'demo.repricing': 'Auto repricing',
    'demo.ads.active': 'Active Ads',
    'demo.ads.position': 'Book position',
    'demo.autopay.detected': 'Payment Detected',
    'demo.autopay.released': 'Crypto Released',
    'demo.autopay.time': 'Processing time',
    'demo.autopay.feed': 'Real-Time Payment Feed',
    'demo.autopay.match': 'Automatic Reconciliation',
    'demo.autopay.savings': 'Time saved vs manual',
    'demo.upgrade': 'Get this Plan',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jarvis_lang');
      if (saved === 'en' || saved === 'es') return saved;
      return navigator.language.startsWith('en') ? 'en' : 'es';
    }
    return 'es';
  });

  const handleSetLang = useCallback((newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('jarvis_lang', newLang);
  }, []);

  const t = useCallback((key: string): string => {
    return translations[lang][key] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
