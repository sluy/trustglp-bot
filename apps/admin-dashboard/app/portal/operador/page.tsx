'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, LogOut, RefreshCw } from 'lucide-react';
import { CLIENT_NAME, CLIENT_SLUG, isFrankTheme, isRafaTheme } from '../../../lib/theme';
import { OperadorP2pView } from './components/OperadorP2pView';

const primaryText = isFrankTheme ? 'text-orange-400' : isRafaTheme ? 'text-emerald-400' : 'text-violet-400';
const primaryBg   = isFrankTheme ? 'bg-orange-500/10' : isRafaTheme ? 'bg-emerald-500/10' : 'bg-violet-500/10';
const primaryBorder = isFrankTheme ? 'border-orange-500/30' : isRafaTheme ? 'border-emerald-500/30' : 'border-violet-500/30';

export default function OperadorPortal() {
  const router = useRouter();
  const [alias, setAlias] = useState('Operador');
  const [userId, setUserId] = useState<number>(0);
  const [brandName, setBrandName] = useState(CLIENT_NAME);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('telecambios_ve_brand_config');
      if (saved) {
        const cfg = JSON.parse(saved);
        if (cfg.clientName) setBrandName(cfg.clientName);
      }
    } catch {}

    fetch('/api/config/public')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
         if (data?.clientName) setBrandName(data.clientName);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const tokenCookie = document.cookie.split(';').find(c => c.trim().startsWith(`${CLIENT_SLUG}_jwt=`));
    if (!tokenCookie) { router.push('/portal/operator'); return; }
    try {
      const token = tokenCookie.split('=')[1];
      const payload = JSON.parse(atob(token));
      setAlias(payload.alias || 'Operador');
      setUserId(payload.userId || 1);
    } catch { router.push('/portal/operator'); }
  }, [router]);

  const logout = () => {
    document.cookie = `${CLIENT_SLUG}_jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    router.push('/');
  };

  return (
    <div className={`min-h-screen text-slate-50 font-sans ${isFrankTheme ? 'bg-[#0a0a0a]' : isRafaTheme ? 'bg-[#021a11]' : 'bg-[#07090f]'}`}>
      {/* Navbar */}
      <nav className="border-b border-[#1a2035] px-4 sm:px-8 h-14 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl bg-[#07090f]/80">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${primaryBg} border ${primaryBorder} flex items-center justify-center`}>
            <Users className={`w-4 h-4 ${primaryText}`} />
          </div>
          <span className="font-black text-white text-sm">{brandName}</span>
          <span className="text-slate-600 text-xs font-mono">· Portal Operador</span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-xs font-mono ${primaryText} hidden sm:flex items-center gap-1.5`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {alias}
          </span>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors font-bold">
            <LogOut className="w-3.5 h-3.5" /> Salir
          </button>
        </div>
      </nav>

      {/* Main content — mismo P2P Marketplace del portal original */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <OperadorP2pView alias={alias} userId={userId} />
      </div>
    </div>
  );
}
