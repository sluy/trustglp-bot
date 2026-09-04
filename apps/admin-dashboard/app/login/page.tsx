'use client';
import { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      if (res.ok && data.accessToken) {
         localStorage.setItem('saas_token', data.accessToken);
         localStorage.setItem('saas_user', JSON.stringify(data.user));
         if (data.user.role === 'ADMIN') {
             window.location.href = '/community';
         } else {
             window.location.href = '/investor';
         }
      } else {
         setError(data.message || 'Credenciales inválidas');
      }
    } catch(err) {
      setError('Error de conexión con el Servidor Quant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col items-center justify-center relative overflow-hidden" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.1), transparent 50%), radial-gradient(circle at 50% 100%, rgba(236, 72, 153, 0.1), transparent 50%)' }}>
       {/* Background Grid */}
       <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
       
       <div className="relative z-10 w-full max-w-md px-6">
          <div className="flex flex-col items-center mb-8">
             <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 rounded-2xl to-purple-600 flex items-center justify-center p-0.5 shadow-[0_0_30px_rgba(99,102,241,0.5)] mb-6 animate-pulse">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                   <Activity className="w-8 h-8 text-indigo-400" />
                </div>
             </div>
             <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                Portal Inversor
             </h1>
             <p className="text-slate-500 mt-2 text-center text-sm">Acceso Encriptado a Telemetría de Portafolio e Inteligencia Algorítmica.</p>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
             <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest pl-1">Correo Electrónico</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-slate-500" /></div>
                     <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-600" placeholder="tu@email.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest pl-1">Clave Cripto</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-slate-500" /></div>
                     <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-12 pr-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-600" placeholder="••••••••••••" />
                  </div>
                </div>

                {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium text-center">{error}</div>}

                <button disabled={loading} type="submit" className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold py-4 px-6 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all flex justify-between items-center group">
                  <span className="flex items-center gap-2">{loading ? "Autenticando..." : "Desbloquear Dashboard"}</span>
                  {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </button>
             </form>
          </div>
          
          <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs font-mono text-center opacity-60">
             <ShieldCheck size={14} /> End-to-End Encryption (AES-256) | Zero-Knowledge Execution
          </div>
       </div>
    </div>
  );
}
