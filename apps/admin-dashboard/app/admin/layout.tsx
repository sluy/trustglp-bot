'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Home, Users, Menu, X, Shield, Lock, Settings, Radar, Bot, Gamepad2 } from 'lucide-react';
import { isP2POnly, isFrankTheme, isRafaTheme, isTelecambiosVeTheme, isJarvisTheme, CLIENT_NAME } from '../../lib/theme';
import { IS_DEMO, getDemoTier, isDemoModuleVisible, getTierLabel, CALENDLY_URL, type DemoTier } from '../../lib/demoMode';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState(CLIENT_NAME);
  const [demoTier, setDemoTier] = useState<DemoTier>('enterprise');

  useEffect(() => {
    // Read brand config from localStorage (non-demo)
    if (!IS_DEMO) {
      try {
        const saved = localStorage.getItem('telecambios_ve_brand_config');
        if (saved) {
          const cfg = JSON.parse(saved);
          if (cfg.clientName) setDisplayName(cfg.clientName);
        }
      } catch {}
    }
    // In demo mode, read tier from URL
    if (IS_DEMO) {
      setDemoTier(getDemoTier());
    }
  }, []);

  // ── Theme colors (including jarvis) ──
  const isGreen = isRafaTheme || isJarvisTheme;
  const navBorder   = isFrankTheme ? 'border-orange-500/15' : isJarvisTheme ? 'border-green-500/15' : isRafaTheme ? 'border-emerald-500/15' : 'border-violet-500/15';
  const navBg       = isFrankTheme ? 'bg-[#0a0a0a]/90' : isJarvisTheme ? 'bg-[#060611]/90' : isRafaTheme ? 'bg-[#022c22]/90' : 'bg-[#07090f]/90';
  const accentLine  = isFrankTheme ? 'via-orange-500/50' : isJarvisTheme ? 'via-green-500/50' : isRafaTheme ? 'via-emerald-500/50' : 'via-violet-500/50';
  const iconBg      = isFrankTheme ? 'bg-orange-500/10 border-orange-500/25' : isJarvisTheme ? 'bg-green-500/10 border-green-500/25' : isRafaTheme ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-violet-500/10 border-violet-500/25';
  const iconColor   = isFrankTheme ? 'text-orange-400' : isJarvisTheme ? 'text-green-400' : isRafaTheme ? 'text-emerald-400' : 'text-violet-400';
  const linkColor   = isFrankTheme ? 'text-slate-300 hover:text-orange-300 hover:bg-orange-500/10' : isJarvisTheme ? 'text-slate-300 hover:text-green-300 hover:bg-green-500/10' : isRafaTheme ? 'text-slate-300 hover:text-emerald-300 hover:bg-emerald-500/10' : 'text-slate-300 hover:text-violet-300 hover:bg-violet-500/10';
  const badgeBg     = isFrankTheme ? 'bg-orange-950/50 text-orange-400 border-orange-500/20' : isJarvisTheme ? 'bg-green-950/50 text-green-400 border-green-500/20' : isRafaTheme ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/20' : 'bg-violet-950/50 text-violet-400 border-violet-500/20';

  // ── Nav items with demo tier visibility ──
  const navItems = [
    { href: '/admin/p2p', icon: Home, label: 'P2P Command Center', module: 'p2p' as const },
    // { href: '/admin/radar', icon: Radar, label: 'Radar Inteligente', module: 'radar' as const },
    { href: '/admin/autopay', icon: Bot, label: 'Auto-Pay Bot', module: 'autopay' as const },
    ...(!isP2POnly ? [{ href: '/admin/operadores', icon: Users, label: 'Operadores', module: 'operadores' as const }] : []),
    { href: '/admin/config', icon: Settings, label: 'Config', module: 'config' as const },
  ].filter(item => !IS_DEMO || isDemoModuleVisible(item.module, demoTier));

  // ── Demo tier switcher handler ──
  const switchTier = (tier: DemoTier) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tier', tier);
    window.location.href = url.toString();
  };

  return (
    <>
      {/* ── Demo Banner ── */}
      {IS_DEMO && (
        <div className="demo-banner">
          <Gamepad2 size={16} />
          <span>MODO DEMO — Los datos son ficticios</span>
          <span style={{ color: '#6a6a8a', fontSize: 11 }}>|</span>
          <span style={{ fontSize: 12, color: '#00d4ff' }}>
            Plan: <strong>{getTierLabel(demoTier)}</strong>
          </span>

          {/* Tier switcher */}
          <span style={{ display: 'inline-flex', gap: 4, marginLeft: 4 }}>
            {(['starter', 'growth', 'enterprise'] as DemoTier[]).map(t => (
              <button
                key={t}
                onClick={() => switchTier(t)}
                style={{
                  padding: '3px 10px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderRadius: 4,
                  border: t === demoTier ? '1px solid #00ff41' : '1px solid #1a1a3e',
                  background: t === demoTier ? 'rgba(0,255,65,0.15)' : 'transparent',
                  color: t === demoTier ? '#00ff41' : '#6a6a8a',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {getTierLabel(t)}
              </button>
            ))}
          </span>

          <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
            Contratar Plan →
          </a>
        </div>
      )}

      <nav className={`border-b ${navBorder} ${navBg} backdrop-blur-xl sticky top-0 z-50 relative overflow-hidden`}>
        {/* Línea superior de color */}
        <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent ${accentLine} to-transparent`} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4 md:gap-8">
              {/* Logo + Nombre */}
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 ${iconBg} border rounded-lg flex items-center justify-center`}>
                  <Shield className={`w-4 h-4 ${iconColor}`} />
                </div>
                {/* Nombre en blanco puro — siempre legible */}
                <span className="text-base md:text-lg font-black tracking-tight text-white whitespace-nowrap">
                  {displayName}
                </span>
              </div>

              {/* Desktop Nav */}
              <div className="hidden md:flex space-x-1">
                {navItems.map(item => (
                  <Link
                    key={item.href}
                    href={IS_DEMO ? `${item.href}?tier=${demoTier}` : item.href}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${linkColor}`}
                  >
                    <item.icon size={16} /> {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {!IS_DEMO && (
                <>
                  <span className={`hidden sm:inline-flex items-center gap-2 text-[10px] px-3 py-1.5 rounded-lg border font-mono tracking-widest ${badgeBg}`}>
                    <Lock className="w-3 h-3" /> ENCRYPTED SESSION
                  </span>
                  <span className={`sm:hidden inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-lg border font-mono tracking-widest ${badgeBg}`}>
                    <Lock className="w-2.5 h-2.5" /> SECURED
                  </span>
                </>
              )}

              {IS_DEMO && (
                <span className={`inline-flex items-center gap-2 text-[10px] px-3 py-1.5 rounded-lg border font-mono tracking-widest ${badgeBg}`}>
                  <Gamepad2 className="w-3 h-3" /> DEMO
                </span>
              )}

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none transition-colors">
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className={`md:hidden border-t ${navBorder} ${navBg} backdrop-blur-xl absolute w-full`}>
            <div className="px-4 py-4 space-y-2">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={IS_DEMO ? `${item.href}?tier=${demoTier}` : item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-lg text-base font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-3"
                >
                  <item.icon size={20} /> {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {isFrankTheme  && <div className="crypto-grid-bg fixed inset-0 pointer-events-none z-0" />}
      {isRafaTheme   && <div className="crypto-grid-bg-rafa fixed inset-0 pointer-events-none z-0" />}
      {isTelecambiosVeTheme  && <div className="telecambios-ve-grid-bg fixed inset-0 pointer-events-none z-0" />}
      {isJarvisTheme && <div className="jarvis-grid-bg fixed inset-0 pointer-events-none z-0" />}

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
        {children}
      </main>
    </>
  );
}
