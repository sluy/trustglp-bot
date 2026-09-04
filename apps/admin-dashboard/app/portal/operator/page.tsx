'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowRight, Network, Activity } from 'lucide-react';
import Link from 'next/link';
import { CLIENT_NAME, CLIENT_SLUG, SUPPORT_EMAIL, C, isFrankTheme, isRafaTheme, isTelecambiosVeTheme } from '../../../lib/theme';

export default function OperatorLogin() {
  const router = useRouter();
  const [loginId, setLoginId]   = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const primaryGradient = isFrankTheme
    ? 'from-orange-500 to-amber-600'
    : isRafaTheme
    ? 'from-emerald-500 to-teal-600'
    : 'from-violet-600 to-indigo-600';

  const ringClass = isFrankTheme
    ? 'focus:ring-orange-500'
    : isRafaTheme
    ? 'focus:ring-emerald-500'
    : 'focus:ring-violet-500';

  const primaryTextClass = isFrankTheme ? 'text-orange-400' : isRafaTheme ? 'text-emerald-400' : 'text-violet-400';
  const iconBgClass = isFrankTheme ? 'from-orange-500 to-amber-600 shadow-orange-500/20' : isRafaTheme ? 'from-emerald-500 to-teal-600 shadow-emerald-500/20' : 'from-violet-600 to-indigo-600 shadow-violet-500/20';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const slug = CLIENT_SLUG || 'telecambios-ve';

    // ── ADMIN BYPASS ──────────────────────────────────────────────────
    const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin147258';
    if (loginId.toLowerCase() === 'admin' && password === adminPass) {
      const mockToken = btoa(JSON.stringify({ userId: 0, role: 'admin', alias: 'admin', exp: Date.now() + 86400000 }));
      document.cookie = `${slug}_jwt=${mockToken}; path=/; max-age=86400; SameSite=Lax`;
      router.push('/admin/p2p');
      setLoading(false);
      return;
    }
    // ─────────────────────────────────────────────────────────────────

    // ── PASO 1: API interna Next.js (server-side, funciona en cualquier browser) ──
    try {
      const res = await fetch('/api/auth/operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      });
      if (res.ok) {
        const data = await res.json();
        document.cookie = `${slug}_jwt=${data.accessToken}; path=/; max-age=86400; SameSite=Lax`;
        router.push('/portal/operador');
        setLoading(false);
        return;
      } else if (res.status === 401) {
        setErrorMsg('Credenciales inválidas. Verifica tu alias y contraseña.');
        setLoading(false);
        return;
      }
      // Status 5xx → continúa a fallback
    } catch { /* Error de red → continúa */ }

    // ── PASO 2: Backend externo ──────────────────────────────────────
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
      if (BASE_URL) {
        const res = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginId, password }),
        });
        const data = await res.json();
        if (res.ok && data.accessToken) {
          document.cookie = `${slug}_jwt=${data.accessToken}; path=/; max-age=86400; SameSite=Lax; ${
            window.location.protocol === 'https:' ? 'Secure' : ''
          }`;
          router.push('/portal/operador');
          setLoading(false);
          return;
        }
      }
    } catch { /* CORS o error de red → continúa */ }

    // ── PASO 3: Fallback localStorage (mismo dispositivo) ─────────────
    try {
      const localOps: any[] = JSON.parse(localStorage.getItem('telecambios_ve_local_operators') || '[]');
      const op = localOps.find((o: any) =>
        (o.alias?.toLowerCase() === loginId.toLowerCase() ||
         o.email?.toLowerCase()  === loginId.toLowerCase()) &&
        o.password === password
      );
      if (op) {
        const mockToken = btoa(JSON.stringify({ userId: op.id, role: 'operator', alias: op.alias, exp: Date.now() + 86400000 }));
        document.cookie = `${slug}_jwt=${mockToken}; path=/; max-age=86400; SameSite=Lax`;
        router.push('/portal/operador');
        setLoading(false);
        return;
      }
    } catch {}

    setErrorMsg('Credenciales inválidas. Verifica tu alias y contraseña.');
    setLoading(false);
  };


  return (
    <div className={`min-h-screen text-slate-50 font-sans flex flex-col justify-center items-center relative overflow-hidden ${
      isFrankTheme ? 'bg-[#0a0a0a]' : isRafaTheme ? 'bg-[#022c22]' : 'bg-[#07090f]'
    }`}>
      {/* Background */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[500px] rounded-full blur-[120px] pointer-events-none ${
        isFrankTheme ? 'bg-orange-900/25' : isRafaTheme ? 'bg-emerald-900/25' : 'bg-violet-900/20'
      }`} />
      {isTelecambiosVeTheme && <div className="telecambios-ve-grid-bg fixed inset-0 pointer-events-none opacity-50" />}

      {/* Back link */}
      <div className="absolute top-6 left-6 z-20">
        <Link href="/" className="text-slate-600 hover:text-slate-400 text-xs font-mono tracking-widest flex items-center gap-2 transition-colors">
          ← Volver al inicio
        </Link>
      </div>

      <div className="z-10 w-full max-w-md px-6">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${iconBgClass} flex items-center justify-center shadow-xl mb-6 border border-white/10`}>
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Portal Operador</h1>
          <p className="text-slate-400 text-center text-sm max-w-xs">
            Acceso para operadores P2P de <strong className="text-slate-200">{CLIENT_NAME}</strong>.
            Ingresa tus credenciales asignadas por el administrador.
          </p>
        </div>

        <form
          id="operator-login-form"
          onSubmit={handleLogin}
          className="bg-slate-900/70 backdrop-blur-md p-8 border border-slate-800 rounded-3xl shadow-2xl"
        >
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold px-4 py-3 rounded-xl mb-6 text-center">
              {errorMsg}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Alias / ID de Operador
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Users className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  required
                  type="text"
                  id="operator-login-id"
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 ${ringClass} transition-all font-medium`}
                  placeholder="Su identificador de operador"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Contraseña
              </label>
              <input
                required
                type="password"
                id="operator-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 ${ringClass} transition-all font-mono tracking-widest text-lg`}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            id="operator-login-submit"
            disabled={loading}
            className={`w-full mt-8 bg-gradient-to-r ${primaryGradient} text-white font-extrabold text-[15px] py-4 rounded-xl transition-all flex justify-center items-center gap-2 group hover:brightness-110 ${
              isFrankTheme ? 'shadow-[0_0_20px_rgba(251,146,60,0.2)] hover:shadow-[0_0_30px_rgba(251,146,60,0.4)]'
              : isRafaTheme ? 'shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]'
              : 'shadow-[0_0_20px_rgba(124,58,237,0.2)] hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]'
            }`}
          >
            {loading ? (
              <span className="animate-pulse">Validando...</span>
            ) : (
              <>
                Ingresar al Sistema{' '}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-8 font-medium">
          ¿Eres administrador?{' '}
          <Link href="/portal/login" className={`${primaryTextClass} hover:underline`}>
            Acceso Admin →
          </Link>
        </p>
        <p className="text-center text-xs text-slate-700 mt-2">
          Soporte: {SUPPORT_EMAIL}
        </p>
      </div>
    </div>
  );
}
