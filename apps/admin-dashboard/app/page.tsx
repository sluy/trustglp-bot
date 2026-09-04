'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, Users, BarChart3, Activity, Zap, Lock,
  ArrowRight, CheckCircle2, AlertTriangle, Circle,
  Network, Cpu, TrendingUp, Clock
} from 'lucide-react';
import { C, CLIENT_NAME, isTelecambiosVeTheme, isFrankTheme, isRafaTheme, isJarvisTheme } from '../lib/theme';
import { IS_DEMO, getDemoTier } from '../lib/demoMode';

// ── Status badge helper ──────────────────────────────────────────────────────
function StatusDot({ status }: { status: 'online' | 'standby' | 'offline' }) {
  const colors = {
    online:  'bg-emerald-400',
    standby: 'bg-amber-400',
    offline: 'bg-red-400',
  };
  const labels = { online: 'ONLINE', standby: 'STANDBY', offline: 'OFFLINE' };
  return (
    <span className="flex items-center gap-2 text-xs font-mono tracking-widest">
      <span className="relative flex h-2 w-2">
        {status === 'online' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${colors[status]}`} />
      </span>
      <span className={status === 'online' ? 'text-emerald-400' : status === 'standby' ? 'text-amber-400' : 'text-red-400'}>
        {labels[status]}
      </span>
    </span>
  );
}

// ── Live metric card ─────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className={`bg-[#0d1117]/80 border border-[#1a2035] rounded-2xl p-5 flex items-center gap-4 hover:border-${color}/40 transition-all duration-300`}>
      <div className={`w-12 h-12 rounded-xl bg-${color}/10 border border-${color}/20 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 text-${color}`} />
      </div>
      <div>
        <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">{label}</p>
        <p className="text-white font-black text-xl tracking-tight">{value}</p>
        {sub && <p className="text-slate-500 text-[10px] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const [stats, setStats] = useState({
    botsOnline: 3,
    operatorsActive: 0,
    spread: '---',
    ordersToday: 0,
    volume24h: '---',
    systemOk: true,
  });

  const [brandName, setBrandName] = useState(CLIENT_NAME);

  useEffect(() => {
    // In demo mode, skip the home page and go straight to the dashboard
    if (IS_DEMO) {
      const tier = getDemoTier();
      router.replace(`/admin/p2p?tier=${tier}`);
      return;
    }
    setMounted(true);
    // Leer identidad desde localStorage
    let tz = 'America/Caracas'; // default
    try {
      const saved = localStorage.getItem('telecambios_ve_brand_config');
      if (saved) {
        const cfg = JSON.parse(saved);
        if (cfg.clientName) setBrandName(cfg.clientName);
        if (cfg.timezone) tz = cfg.timezone;
      }
    } catch {}
    // Reloj en tiempo real usando la zona horaria configurada
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz }));
    };
    tick();
    const interval = setInterval(tick, 1000);

    // Fetch estadísticas del sistema
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
    if (BASE_URL) {
      fetch(`${BASE_URL}/system/status`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) setStats(prev => ({ ...prev, ...data }));
        })
        .catch(() => {});
    }

    return () => clearInterval(interval);
  }, []);


  // Paleta activa
  const primary = isFrankTheme ? 'orange' : isRafaTheme ? 'emerald' : 'violet';
  const secondary = isFrankTheme ? 'amber' : isRafaTheme ? 'teal' : 'amber';

  const bgClass = isFrankTheme
    ? 'bg-[#0a0a0a]'
    : isRafaTheme
    ? 'bg-[#022c22]'
    : 'bg-[#07090f]';

  const primaryGradient = isFrankTheme
    ? 'from-orange-400 via-amber-400 to-yellow-400'
    : isRafaTheme
    ? 'from-emerald-400 via-teal-400 to-green-400'
    : 'from-violet-400 via-purple-400 to-indigo-400';

  const cardBorder = isFrankTheme
    ? 'border-orange-500/20 hover:border-orange-500/50'
    : isRafaTheme
    ? 'border-emerald-500/20 hover:border-emerald-500/50'
    : 'border-violet-500/20 hover:border-violet-500/50';

  const glowBg = isFrankTheme
    ? 'bg-orange-600/8'
    : isRafaTheme
    ? 'bg-emerald-600/8'
    : 'bg-violet-600/8';

  const primaryTextClass = isFrankTheme ? 'text-orange-400' : isRafaTheme ? 'text-emerald-400' : 'text-violet-400';
  const primaryBgClass = isFrankTheme ? 'bg-orange-500/10' : isRafaTheme ? 'bg-emerald-500/10' : 'bg-violet-500/10';
  const primaryBorderClass = isFrankTheme ? 'border-orange-500/30' : isRafaTheme ? 'border-emerald-500/30' : 'border-violet-500/30';
  const pingClass = isFrankTheme ? 'bg-orange-400' : isRafaTheme ? 'bg-emerald-400' : 'bg-violet-400';

  return (
    <div className={`${bgClass} min-h-screen text-slate-50 font-sans overflow-x-hidden relative`}>

      {/* ── Fondo animado ────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Grid */}
        {isTelecambiosVeTheme ? (
          <div className="telecambios-ve-grid-bg absolute inset-0" />
        ) : isFrankTheme ? (
          <div className="crypto-grid-bg absolute inset-0" />
        ) : (
          <div className="crypto-grid-bg-rafa absolute inset-0" />
        )}
        {/* Orbs */}
        <div className={`absolute top-[-15%] left-[-10%] w-[700px] h-[700px] rounded-full ${
          isFrankTheme ? 'bg-orange-600/8' : isRafaTheme ? 'bg-emerald-600/8' : 'bg-violet-700/10'
        } blur-[140px]`} />
        <div className={`absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full ${
          isFrankTheme ? 'bg-amber-600/8' : isRafaTheme ? 'bg-teal-600/8' : 'bg-indigo-700/8'
        } blur-[140px]`} />
        {/* Punto central */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full ${
          isFrankTheme ? 'bg-orange-500/3' : isRafaTheme ? 'bg-emerald-500/3' : 'bg-violet-500/4'
        } blur-[120px]`} />
      </div>

      {/* ── Navbar ──────────────────────────────────── */}
      <nav className={`relative z-50 border-b ${
        isFrankTheme ? 'border-orange-500/10 bg-[#0a0a0a]/70' :
        isRafaTheme  ? 'border-emerald-500/10 bg-[#022c22]/70' :
                       'border-violet-500/10 bg-[#07090f]/70'
      } backdrop-blur-2xl`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18 py-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                isFrankTheme ? 'bg-orange-500/10 border-orange-500/20' :
                isRafaTheme  ? 'bg-emerald-500/10 border-emerald-500/20' :
                               'bg-violet-500/10 border-violet-500/20'
              }`}>
                <Network className={`w-5 h-5 ${primaryTextClass}`} />
              </div>
              <div>
                <span className={`text-lg font-black tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r ${primaryGradient}`}>
                  {brandName}
                </span>
                <p className="text-[9px] text-slate-600 font-mono tracking-[0.2em] uppercase">P2P Management System</p>
              </div>
            </div>

            {/* Sistema status */}
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${pingClass} animate-pulse`} />
                <span className="text-slate-500 text-xs font-mono">SISTEMA ACTIVO</span>
              </div>
              {mounted && (
                <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className="text-slate-400 font-mono text-xs tracking-widest">{time}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero: Título del Sistema ──────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 text-center">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${primaryBgClass} border ${primaryBorderClass} ${primaryTextClass} text-[10px] font-mono tracking-widest uppercase mb-8`}>
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pingClass} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${pingClass}`} />
          </span>
          Sistema Operativo P2P — En Línea
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-6 text-white leading-[1.02]">
          Gestión de{' '}
          <span className={`bg-clip-text text-transparent bg-gradient-to-r ${primaryGradient}`}>
            Equipo P2P
          </span>
          <br />
          <span className="text-slate-400 text-4xl md:text-5xl font-bold">Automatizada e Inteligente</span>
        </h1>

        <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed mb-4">
          Plataforma centralizada para la gestión operativa de{' '}
          <strong className="text-slate-200">operadores P2P</strong>, seguimiento de spreads,
          órdenes automáticas y control de capital en tiempo real.
        </p>
      </section>

      {/* ── Métricas del Sistema ──────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Bots */}
          <div className={`bg-[#0d1117]/80 border ${
            stats.systemOk ? (isFrankTheme ? 'border-orange-500/15' : isRafaTheme ? 'border-emerald-500/15' : 'border-violet-500/15')
                            : 'border-red-500/20'
          } rounded-2xl p-5 transition-all duration-300 group hover:scale-[1.02]`}>
            <div className="flex justify-between items-start mb-3">
              <Cpu className={`w-5 h-5 ${primaryTextClass}`} />
              <StatusDot status={stats.systemOk ? 'online' : 'offline'} />
            </div>
            <p className="text-white font-black text-2xl">{stats.botsOnline}</p>
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mt-1">Bots Activos</p>
          </div>

          {/* Operadores */}
          <div className="bg-[#0d1117]/80 border border-[#1a2035] rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02]">
            <div className="flex justify-between items-start mb-3">
              <Users className="w-5 h-5 text-sky-400" />
              <StatusDot status="online" />
            </div>
            <p className="text-white font-black text-2xl">{mounted ? stats.operatorsActive : '--'}</p>
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mt-1">Operadores Activos</p>
          </div>

          {/* Spread */}
          <div className="bg-[#0d1117]/80 border border-[#1a2035] rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02]">
            <div className="flex justify-between items-start mb-3">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-white font-black text-2xl">{mounted ? stats.spread : '---'}</p>
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mt-1">Spread P2P Live</p>
          </div>

          {/* Órdenes */}
          <div className="bg-[#0d1117]/80 border border-[#1a2035] rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02]">
            <div className="flex justify-between items-start mb-3">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-white font-black text-2xl">{mounted ? stats.ordersToday : '--'}</p>
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mt-1">Órdenes Hoy</p>
          </div>
        </div>

        {/* ── Dual Login Cards ──────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          {/* OPERADOR */}
          <div className={`relative group bg-gradient-to-br from-[#0d1117] to-[#0a0d16] border ${cardBorder} rounded-3xl p-8 lg:p-10 transition-all duration-400 overflow-hidden shadow-2xl`}>
            {/* Glow BG */}
            <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl transition-all duration-500 opacity-0 group-hover:opacity-100 ${
              isFrankTheme ? 'bg-orange-500/10' : isRafaTheme ? 'bg-emerald-500/10' : 'bg-violet-500/10'
            }`} />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 ${
                  isFrankTheme ? 'bg-orange-500/10 border-orange-500/20' :
                  isRafaTheme  ? 'bg-emerald-500/10 border-emerald-500/20' :
                                 'bg-violet-500/10 border-violet-500/20'
                }`}>
                  <Users className={`w-7 h-7 ${primaryTextClass}`} />
                </div>
                <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest border border-slate-800 px-3 py-1 rounded-full">
                  NIVEL 1
                </span>
              </div>

              <h2 className="text-3xl font-black text-white mb-3 tracking-tight">Operador P2P</h2>
              <p className="text-slate-400 leading-relaxed mb-8">
                Acceso al panel de gestión de <strong className="text-slate-200">órdenes activas</strong>,
                monitoreo de transacciones, historial de operaciones y notificaciones del sistema.
              </p>

              {/* Features */}
              <ul className="space-y-2 mb-8">
                {['Ver órdenes P2P activas', 'Monitorear spreads en vivo', 'Historial de transacciones', 'Notificaciones de alertas'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${primaryTextClass}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/portal/operator"
                className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-black tracking-widest uppercase text-sm border transition-all duration-300 group/btn ${
                  isFrankTheme
                    ? 'border-orange-500/40 text-orange-400 hover:bg-orange-500 hover:text-slate-950 hover:border-orange-400 hover:shadow-[0_0_25px_rgba(251,146,60,0.4)]'
                    : isRafaTheme
                    ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:border-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                    : 'border-violet-500/40 text-violet-400 hover:bg-violet-500 hover:text-slate-950 hover:border-violet-400 hover:shadow-[0_0_25px_rgba(124,58,237,0.4)]'
                }`}
                id="btn-operator-login"
              >
                Ingresar como Operador
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* ADMINISTRADOR */}
          <div className={`relative group bg-gradient-to-br border rounded-3xl p-8 lg:p-10 transition-all duration-400 overflow-hidden shadow-2xl ${
            isFrankTheme
              ? 'from-orange-950/30 to-[#0d1117] border-orange-500/30 hover:border-orange-500/60'
              : isRafaTheme
              ? 'from-emerald-950/30 to-[#0d1117] border-emerald-500/30 hover:border-emerald-500/60'
              : 'from-violet-950/25 to-[#0d1117] border-violet-500/30 hover:border-violet-500/60'
          }`}>
            {/* Glow */}
            <div className={`absolute -top-20 -left-20 w-72 h-72 rounded-full blur-3xl transition-all duration-500 ${
              isFrankTheme ? 'bg-orange-500/15 group-hover:bg-orange-500/25' :
              isRafaTheme  ? 'bg-emerald-500/15 group-hover:bg-emerald-500/25' :
                             'bg-violet-500/12 group-hover:bg-violet-500/20'
            }`} />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 ${
                  isFrankTheme ? 'bg-orange-500/20 border-orange-500/40 shadow-[0_0_20px_rgba(251,146,60,0.2)]' :
                  isRafaTheme  ? 'bg-emerald-500/20 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)]' :
                                 'bg-violet-500/20 border-violet-500/40 shadow-[0_0_20px_rgba(124,58,237,0.2)]'
                }`}>
                  <ShieldCheck className={`w-7 h-7 ${primaryTextClass}`} />
                </div>
                <span className={`text-[10px] font-mono uppercase tracking-widest border px-3 py-1 rounded-full ${primaryTextClass} ${primaryBgClass} ${primaryBorderClass}`}>
                  NIVEL ADMIN
                </span>
              </div>

              <h2 className="text-3xl font-black text-white mb-3 tracking-tight">Administrador</h2>
              <p className="text-slate-400 leading-relaxed mb-8">
                Control total del sistema: configuración de <strong className="text-slate-200">bots, capital, API keys</strong>,
                gestión de operadores, branding de la plataforma y auditoría completa.
              </p>

              {/* Features */}
              <ul className="space-y-2 mb-8">
                {[
                  'Control total de bots P2P y Grid',
                  'Gestión de capital y riesgo',
                  'Configuración de API Keys',
                  'Branding y personalización',
                  'Auditoría y reportes avanzados',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${primaryTextClass}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/portal/login"
                className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-black tracking-widest uppercase text-sm transition-all duration-300 group/btn ${
                  isFrankTheme
                    ? 'bg-orange-500 text-slate-950 hover:bg-orange-400 shadow-[0_0_25px_rgba(251,146,60,0.3)] hover:shadow-[0_0_35px_rgba(251,146,60,0.5)]'
                    : isRafaTheme
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-[0_0_35px_rgba(16,185,129,0.5)]'
                    : 'bg-violet-600 text-white hover:bg-violet-500 shadow-[0_0_25px_rgba(124,58,237,0.35)] hover:shadow-[0_0_40px_rgba(124,58,237,0.55)]'
                }`}
                id="btn-admin-login"
              >
                <Lock className="w-4 h-4" />
                Acceso Administrador
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Info Row: Módulos del Sistema ─────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Activity,    label: 'Market Scanner',  desc: 'Binance & Bybit P2P', status: 'online'  as const },
            { icon: Zap,         label: 'Smart Pricing',   desc: 'Precios dinámicos',    status: 'online'  as const },
            { icon: ShieldCheck, label: 'Auto-Pay Bot',    desc: 'Módulo adicional',     status: 'standby' as const },
          ].map(({ icon: Icon, label, desc, status }) => (
            <div
              key={label}
              className="bg-[#0d1117]/60 border border-[#1a2035] rounded-xl p-4 flex items-center gap-3 hover:border-slate-700 transition-all"
            >
              <div className={`w-9 h-9 rounded-lg ${primaryBgClass} border ${primaryBorderClass} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${primaryTextClass}`} />
              </div>
              <div className="min-w-0">
                <p className="text-slate-200 text-xs font-bold truncate">{label}</p>
                <p className="text-slate-600 text-[10px] font-mono truncate">{desc}</p>
              </div>
              <StatusDot status={status} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className={`relative z-10 border-t ${
        isFrankTheme ? 'border-orange-500/5' : isRafaTheme ? 'border-emerald-500/5' : 'border-violet-500/5'
      } py-8 mt-8`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs font-mono tracking-widest">
            © {new Date().getFullYear()} {CLIENT_NAME} · P2P Management System
          </p>
          <div className="flex items-center gap-6">
            <span className={`text-[10px] font-mono ${primaryTextClass} flex items-center gap-2`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pingClass} animate-pulse`} />
              SISTEMA OPERATIVO
            </span>
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@telecambiosve.com'}`}
              className="text-slate-600 hover:text-slate-400 text-xs font-mono transition-colors"
            >
              Soporte Técnico
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
