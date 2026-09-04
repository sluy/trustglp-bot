'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import Link from 'next/link';
import { CLIENT_NAME, isFrankTheme, isRafaTheme, SUPPORT_EMAIL } from '../../../lib/theme';

export default function PortalLogin() {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password reset stage
  const [isResetStage, setIsResetStage] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    // ── ADMIN BYPASS (funciona en dev y producción) ───────────────────
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin147258';
    if (loginId.toLowerCase() === 'admin' && password === adminPassword) {
      const mockToken = btoa(JSON.stringify({ userId: 0, role: 'admin', alias: 'admin', exp: Date.now() + 86400000 }));
      const slug = process.env.NEXT_PUBLIC_CLIENT_SLUG || 'telecambios-ve';
      document.cookie = `${slug}_jwt=${mockToken}; path=/; max-age=86400; SameSite=Lax`;
      router.push('/admin/p2p');
      setLoading(false);
      return;
    }
    // ────────────────────────────────────────────────────────────────


    try {
      const slug = process.env.NEXT_PUBLIC_CLIENT_SLUG || 'telecambios-ve';

      // ── 1. Intentar con la API interna de Next.js (server-side, funciona en todos los browsers) ──
      try {
        const internalRes = await fetch('/api/auth/operator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginId, password }),
        });
        if (internalRes.ok) {
          const data = await internalRes.json();
          document.cookie = `${slug}_jwt=${data.accessToken}; path=/; max-age=86400; SameSite=Lax`;
          router.push('/portal/operador');
          setLoading(false);
          return;
        } else if (internalRes.status === 401) {
          // Credenciales incorrectas (usuario existe pero clave mala)
          setErrorMsg('Credenciales inválidas. Verifica tu alias y contraseña.');
          setLoading(false);
          return;
        }
        // Si es otro error (500 etc), continúa al fallback
      } catch { /* Continúa con fallback */ }

      // ── 2. Fallback: backend externo ───────────────────────────────────────
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
      if (BASE_URL) {
        const res = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginId, password }),
        });
        const data = await res.json();
        if (res.ok && data.accessToken) {
          if (data.requirePasswordChange) {
            setTempToken(data.accessToken);
            setIsResetStage(true);
            setErrorMsg('');
          } else {
            document.cookie = `${slug}_jwt=${data.accessToken}; path=/; max-age=86400; SameSite=Lax; ${
              window.location.protocol === 'https:' ? 'Secure' : ''
            }`;
            router.push('/portal/dashboard');
          }
          setLoading(false);
          return;
        }
      }

      // ── 3. Fallback final: localStorage (mismo dispositivo) ────────────────
      const localOps = JSON.parse(localStorage.getItem('telecambios_ve_local_operators') || '[]');
      const op = localOps.find((o: any) =>
        (o.alias?.toLowerCase() === loginId.toLowerCase() ||
         o.email?.toLowerCase()  === loginId.toLowerCase()) &&
        o.password === password
      );
      if (op) {
        const mockToken = btoa(JSON.stringify({ userId: op.id, role: 'operator', alias: op.alias, exp: Date.now() + 86400000 }));
        document.cookie = `${slug}_jwt=${mockToken}; path=/; max-age=86400; SameSite=Lax`;
        router.push('/portal/operador');
      } else {
        setErrorMsg('Credenciales inválidas. Verifica tu alias y contraseña.');
      }

    } finally {
      setLoading(false);
    }
  };


  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
       setErrorMsg('La contraseña debe tener al menos 8 caracteres');
       return;
    }
    if (newPassword !== confirmPassword) {
       setErrorMsg('Las contraseñas no coinciden');
       return;
    }
    
    setLoading(true);
    setErrorMsg('');
    
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${BASE_URL}/auth/change-password`, {
         method: 'POST',
         headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tempToken}`
         },
         body: JSON.stringify({ newPassword })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
         // Clave cambiada exitosamente. Autenticarlo oficialmente.
         document.cookie = `${process.env.NEXT_PUBLIC_CLIENT_SLUG || 'telecambios-ve'}_jwt=${tempToken}; path=/; max-age=86400; SameSite=Lax; ${window.location.protocol === 'https:' ? 'Secure' : ''}`;
         router.push('/portal/dashboard');
      } else {
         setErrorMsg(data.message || 'Error actualizando contraseña');
      }
    } catch (e) {
      setErrorMsg('Error de conexión con el Servidor Quant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen text-slate-50 font-sans flex flex-col justify-center items-center relative overflow-hidden ${
      isFrankTheme ? 'bg-[#0a0a0a]' : isRafaTheme ? 'bg-[#022c22]' : 'bg-[#07090f]'
    }`}>
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] blur-[100px] pointer-events-none rounded-full ${
        isFrankTheme ? 'bg-orange-900/25' : isRafaTheme ? 'bg-emerald-900/25' : 'bg-violet-900/20'
      }`} />
      <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-5">
        <Activity size={400} />
      </div>

      <div className="absolute top-6 left-6 z-20">
        <Link href="/" className="text-slate-600 hover:text-slate-400 text-xs font-mono tracking-widest flex items-center gap-2 transition-colors">
          ← Inicio
        </Link>
      </div>

      <div className="z-10 w-full max-w-md px-6">
        <div className="flex flex-col items-center mb-10">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl mb-6 border border-white/10 bg-gradient-to-br ${
            isFrankTheme ? 'from-orange-500 to-amber-600 shadow-orange-500/20'
            : isRafaTheme ? 'from-emerald-500 to-teal-600 shadow-emerald-500/20'
            : 'from-violet-600 to-indigo-600 shadow-violet-500/20'
          }`}>
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            {isResetStage ? 'Acceso Bloqueado' : 'Portal Administrador'}
          </h1>
          <p className="text-slate-400 text-center text-sm max-w-xs">
            {isResetStage
              ? 'Debes cambiar tu contraseña provisoria antes de continuar.'
              : `Acceso exclusivo para administradores de ${CLIENT_NAME}. Credenciales asignadas por el sistema.`}
          </p>
        </div>

        {isResetStage ? (
           <form onSubmit={handleResetPassword} className="bg-slate-900/80 backdrop-blur-md p-8 border border-slate-800 rounded-3xl shadow-2xl relative animate-in slide-in-from-bottom-6 duration-500">
             {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold px-4 py-3 rounded-xl mb-6 text-center animate-in fade-in">
                  {errorMsg}
                </div>
             )}
             <div className="space-y-5">
                <div>
                   <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Nueva Contraseña (Secreta)</label>
                   <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono tracking-widest text-lg placeholder:text-sm placeholder:tracking-normal" placeholder="••••••••" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Confirmar Contraseña</label>
                   <input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono tracking-widest text-lg placeholder:text-sm placeholder:tracking-normal" placeholder="••••••••" />
                </div>
             </div>
             <button disabled={loading} className="w-full mt-8 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-[15px] py-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all flex justify-center items-center gap-2 group">
                {loading ? <span className="animate-pulse">Cifrando...</span> : <>Confirmar Cambio <Lock className="w-4 h-4 ml-1" /></>}
             </button>
             <button type="button" onClick={() => {setIsResetStage(false); setTempToken('');}} className="w-full mt-4 text-slate-400 hover:text-white text-xs font-semibold py-2">Volver Atrás</button>
           </form>
        ) : (
           <form onSubmit={handleLogin} className="bg-slate-900/80 backdrop-blur-md p-8 border border-slate-800 rounded-3xl shadow-2xl relative">
             
             {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold px-4 py-3 rounded-xl mb-6 text-center animate-in fade-in">
                  {errorMsg}
                </div>
             )}

          <div className="space-y-5">
             <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Alias / Correo</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-4 w-4 text-slate-500" /></div>
                   <input required type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Su identificador" />
                </div>
             </div>

             <div>
                <div className="flex justify-between items-center mb-1.5">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contraseña de Control</label>
                </div>
                <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono tracking-widest text-lg placeholder:text-sm placeholder:tracking-normal" placeholder="••••••••" />
             </div>
          </div>

              <button disabled={loading} className={`w-full mt-8 text-white font-extrabold text-[15px] py-4 rounded-xl transition-all flex justify-center items-center gap-2 group bg-gradient-to-r ${
                isFrankTheme ? 'from-orange-500 to-amber-600 hover:from-orange-400 to-amber-500 shadow-[0_0_20px_rgba(251,146,60,0.2)] hover:shadow-[0_0_30px_rgba(251,146,60,0.4)]'
                : isRafaTheme ? 'from-emerald-500 to-teal-600 hover:from-emerald-400 to-teal-500 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]'
                : 'from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(124,58,237,0.2)] hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]'
              }`}>
                {loading ? <span className="animate-pulse">Validando...</span> : <>Acceder al Sistema <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
              </button>
           </form>
        )}

        <p className="text-center text-xs text-slate-500 mt-10 font-medium">
          Acceso estrictamente monitoreado. Soporte: {SUPPORT_EMAIL}
        </p>
        <p className="text-center text-xs text-slate-600 mt-2">
          ¿Eres operador?{' '}
          <Link href="/portal/operator" className={isFrankTheme ? 'text-orange-400 hover:underline' : isRafaTheme ? 'text-emerald-400 hover:underline' : 'text-violet-400 hover:underline'}>
            Acceso Operador →
          </Link>
        </p>
      </div>
    </div>
  );
}
