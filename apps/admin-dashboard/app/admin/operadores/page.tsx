'use client';
import { useState, useEffect } from 'react';
import {
  Users, UserPlus, Key, Trash2, Check, X, Activity,
  ArrowRightLeft, TrendingUp, ShieldCheck, Edit2,
  RefreshCw, BarChart2, Clock, Banknote, Award
} from 'lucide-react';
import { isFrankTheme, isRafaTheme, isJarvisTheme } from '../../../lib/theme';

const _green = isRafaTheme || isJarvisTheme;
const primary      = isFrankTheme ? 'text-orange-400'          : _green ? 'text-emerald-400'  : 'text-violet-400';
const primaryBg    = isFrankTheme ? 'bg-orange-500/10'         : _green ? 'bg-emerald-500/10' : 'bg-violet-500/10';
const primaryBorder= isFrankTheme ? 'border-orange-500/20'     : _green ? 'border-emerald-500/20' : 'border-violet-500/20';
const primaryBtn   = isFrankTheme
  ? 'bg-orange-500 hover:bg-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.3)]'
  : _green
  ? 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
  : 'bg-violet-600 hover:bg-violet-500 shadow-[0_0_20px_rgba(124,58,237,0.3)]';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Operador {
  id: number;
  alias: string;
  email?: string;
  status: string;
  createdAt: string;
  // Stats P2P
  totalOrders?: number;
  completedOrders?: number;
  totalVolumeUsdt?: number;
  totalVolumeFiat?: number;
  successRate?: number;
  lastActiveAt?: string;
  p2pUsdtBalance?: number;
}

// Operador de prueba para QA (solo visible si el backend no responde)
const TEST_OPERATOR: Operador[] = [
  { id: 1, alias: 'operador', email: 'test@telecambiosve.com', status: 'ACTIVE', createdAt: new Date().toISOString(), totalOrders: 0, completedOrders: 0, totalVolumeUsdt: 0, totalVolumeFiat: 0, successRate: 0, lastActiveAt: '', p2pUsdtBalance: 0 },
];

const timeSince = (iso: string) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Hace <1h';
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${Math.floor(h/24)}d`;
};

export default function OperadoresPage() {
  const [ops, setOps] = useState<Operador[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModal, setIsEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingOp, setEditingOp] = useState<Operador | null>(null);
  const [selectedOp, setSelectedOp] = useState<Operador | null>(null);

  const [form, setForm] = useState({ alias: '', email: '', password: '' });
  const [editCredsForm, setEditCredsForm] = useState({ email: '', password: '' });

  const fetchOperators = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/operators');
      if (res.ok) {
        const data = await res.json();
        setOps(Array.isArray(data) && data.length > 0 ? data : TEST_OPERATOR);
      } else {
        // Fallback: localStorage si la API falla
        const localOps: Operador[] = JSON.parse(localStorage.getItem('telecambios_ve_local_operators') || '[]');
        setOps(localOps.length ? localOps : TEST_OPERATOR);
      }
    } catch {
      const localOps: Operador[] = JSON.parse(localStorage.getItem('telecambios_ve_local_operators') || '[]');
      setOps(localOps.length ? localOps : TEST_OPERATOR);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchOperators(); }, []);

  const handleCreate = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'operator' }),
      });
      if (res.ok || res.status === 201) {
        setIsModalOpen(false);
        setForm({ alias: '', email: '', password: '' });
        await fetchOperators();
      } else if (res.status === 409) {
        alert('Ya existe un operador con ese alias o email.');
      } else {
        alert('Error creando operador.');
      }
    } catch {
      alert('Error de conexión con el servidor.');
    } finally { setSaving(false); }
  };

  const handleEditCreds = async (e: any) => {
    e.preventDefault();
    if (!editingOp) return;
    setSaving(true);
    try {
      const body: any = {};
      if (editCredsForm.email)    body.email    = editCredsForm.email;
      if (editCredsForm.password) body.password = editCredsForm.password;
      const res = await fetch(`/api/operators/${editingOp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setIsEditModal(false); setEditingOp(null); setEditCredsForm({ email: '', password: '' });
        await fetchOperators();
      } else {
        alert('Error actualizando credenciales.');
      }
    } catch { alert('Error de conexión.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, alias: string) => {
    if (!confirm(`¿Eliminar al operador "${alias}"? Se revocarán sus accesos al portal.`)) return;
    try {
      const res = await fetch(`/api/operators/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setOps(prev => prev.filter(o => o.id !== id));
      } else {
        alert('Error eliminando operador.');
      }
    } catch {
      // Fallback: remove from local state
      setOps(prev => prev.filter(o => o.id !== id));
    }
  };

  // Totales del panel
  const totalOrders   = ops.reduce((a, o) => a + (o.totalOrders || 0), 0);
  const totalVolUsdt  = ops.reduce((a, o) => a + (o.totalVolumeUsdt || 0), 0);
  const totalBalance  = ops.reduce((a, o) => a + (o.p2pUsdtBalance || 0), 0);
  const avgSuccess    = ops.length ? ops.reduce((a, o) => a + (o.successRate || 0), 0) / ops.length : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">

      {/* HEADER */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className={`text-3xl font-black tracking-tight flex items-center gap-3 ${isFrankTheme ? 'text-orange-400' : isRafaTheme ? 'text-emerald-400' : 'text-violet-400'}`}>
            <Users className="w-8 h-8" /> Operadores P2P
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Registro, accesos y estadísticas de rendimiento por operador</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchOperators} className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold px-4 py-2 border border-slate-700 rounded-xl hover:bg-slate-800 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
          <button onClick={() => setIsModalOpen(true)} className={`flex items-center gap-2 text-white text-xs font-black px-5 py-2.5 rounded-xl uppercase tracking-wider transition-all ${primaryBtn}`}>
            <UserPlus className="w-4 h-4" /> Nuevo Operador
          </button>
        </div>
      </header>

      {/* STATS GLOBALES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users,         label: 'Operadores Activos', value: ops.filter(o => o.status === 'ACTIVE').length.toString(),         color: primary },
          { icon: ArrowRightLeft,label: 'Órdenes Totales',    value: totalOrders.toLocaleString(),                                       color: 'text-sky-400' },
          { icon: TrendingUp,    label: 'Volumen USDT',       value: `$${(totalVolUsdt/1000).toFixed(1)}k`,                              color: 'text-emerald-400' },
          { icon: Award,         label: 'Tasa Éxito Prom.',  value: `${avgSuccess.toFixed(1)}%`,                                        color: 'text-amber-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-[#0d1117] border border-[#1a2035] rounded-2xl p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Icon className={`w-16 h-16 ${color}`} />
            </div>
            <p className="text-slate-500 text-xs uppercase tracking-wider font-bold mb-1">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* TABLA OPERADORES */}
      <div className="bg-[#0d1117] border border-[#1a2035] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1a2035] flex justify-between items-center">
          <h2 className="font-black text-white flex items-center gap-2 text-sm uppercase tracking-widest">
            <BarChart2 className={`w-4 h-4 ${primary}`} /> Rendimiento Individual
          </h2>
          <span className="text-xs font-mono text-slate-500">{ops.length} operadores registrados</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-600 animate-pulse font-mono text-sm">Cargando operadores...</div>
        ) : ops.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 font-mono text-sm">Sin operadores registrados</p>
            <p className="text-slate-600 text-xs mt-1">Crea el primer operador para empezar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-[10px] text-slate-500 uppercase tracking-widest bg-[#07090f]">
                <tr>
                  <th className="px-6 py-3">Operador</th>
                  <th className="px-6 py-3 text-center">Estado</th>
                  <th className="px-6 py-3 text-right">Órdenes</th>
                  <th className="px-6 py-3 text-right">Volumen USDT</th>
                  <th className="px-6 py-3 text-right">Volumen VES</th>
                  <th className="px-6 py-3 text-right">Tasa Éxito</th>
                  <th className="px-6 py-3 text-right">Balance USDT</th>
                  <th className="px-6 py-3 text-right">Últ. Activo</th>
                  <th className="px-6 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2035]">
                {ops.map(op => (
                  <tr key={op.id}
                    onClick={() => setSelectedOp(selectedOp?.id === op.id ? null : op)}
                    className="hover:bg-slate-800/20 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="font-black text-white">{op.alias}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{op.email || 'sin email'}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {op.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-black text-white">{(op.completedOrders || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-slate-600 font-mono">{(op.totalOrders || 0)} totales</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-black text-emerald-400">${(op.totalVolumeUsdt || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-mono text-slate-300 text-xs">
                        {((op.totalVolumeFiat || 0) / 1_000_000).toFixed(1)}M Bs
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`font-black text-lg ${(op.successRate || 0) >= 95 ? 'text-emerald-400' : (op.successRate || 0) >= 85 ? 'text-amber-400' : 'text-red-400'}`}>
                        {(op.successRate || 0).toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`font-black text-sm ${primary}`}>${(op.p2pUsdtBalance || 0).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-xs text-slate-500 font-mono whitespace-nowrap">{timeSince(op.lastActiveAt || '')}</div>
                    </td>
                    <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => { setEditingOp(op); setEditCredsForm({ email: '', password: '' }); setIsEditModal(true); }}
                          className="p-2 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-all" title="Editar credenciales">
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(op.id, op.alias)}
                          className="p-2 text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all" title="Eliminar operador">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETALLE EXPANDIDO del operador seleccionado */}
      {selectedOp && (
        <div className={`bg-[#0d1117] border ${primaryBorder} rounded-2xl p-6 space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className={`font-black text-lg ${primary} flex items-center gap-2`}>
              <Activity className="w-5 h-5" /> Detalle — {selectedOp.alias}
            </h3>
            <button onClick={() => setSelectedOp(null)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Órdenes Completadas', value: (selectedOp.completedOrders || 0).toLocaleString(), icon: ArrowRightLeft, color: 'text-sky-400' },
              { label: 'Volumen Total USDT',  value: `$${(selectedOp.totalVolumeUsdt || 0).toLocaleString()}`, icon: TrendingUp,     color: 'text-emerald-400' },
              { label: 'Volumen Total Fiat',  value: `${((selectedOp.totalVolumeFiat||0)/1_000_000).toFixed(1)}M Bs`, icon: Banknote, color: 'text-violet-400' },
              { label: 'Tasa de Éxito',       value: `${(selectedOp.successRate||0).toFixed(1)}%`, icon: ShieldCheck,  color: (selectedOp.successRate||0) >= 95 ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'Balance Acumulado',   value: `$${(selectedOp.p2pUsdtBalance||0).toFixed(2)} USDT`, icon: Banknote, color: primary },
              { label: 'Miembro desde',       value: new Date(selectedOp.createdAt).toLocaleDateString('es-VE'), icon: Clock, color: 'text-slate-400' },
              { label: 'Última actividad',    value: timeSince(selectedOp.lastActiveAt || ''), icon: Activity,  color: 'text-slate-400' },
              { label: 'Órdenes Fallidas',    value: ((selectedOp.totalOrders||0) - (selectedOp.completedOrders||0)).toString(), icon: X, color: 'text-red-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-[#07090f] border border-[#1a2035] rounded-xl p-4">
                <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{label}</span>
                </div>
                <p className={`font-black text-lg ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CREAR OPERADOR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0d1117] border border-[#1a2035] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-[#1a2035]">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <UserPlus className={`w-5 h-5 ${primary}`} /> Nuevo Operador
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-red-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                El operador podrá acceder a <strong className="text-white">/portal/operator</strong> con su alias y contraseña para gestionar órdenes P2P.
              </p>
              {[
                { label: 'Alias del Operador', key: 'alias', type: 'text',     placeholder: 'Ej. SirCaiza', required: true },
                { label: 'Email (Opcional)',   key: 'email', type: 'email',    placeholder: 'op@empresa.com', required: false },
                { label: 'Contraseña',         key: 'password', type: 'password', placeholder: '••••••••', required: true },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">{f.label}</label>
                  <input
                    required={f.required} type={f.type} placeholder={f.placeholder}
                    value={(form as any)[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full bg-[#07090f] border border-[#1a2035] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                  />
                </div>
              ))}
              <p className="flex items-center gap-1.5 text-[10px] text-emerald-500 mt-1">
                <ShieldCheck className="w-3 h-3" /> Contraseña encriptada con bcrypt en base de datos
              </p>
              <button disabled={saving} className={`w-full mt-4 text-white font-black py-3 rounded-xl text-sm uppercase tracking-wider transition-all flex justify-center items-center gap-2 ${primaryBtn}`}>
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creando...</> : <><Check className="w-4 h-4" /> Crear Operador</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR CREDENCIALES */}
      {isEditModal && editingOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0d1117] border border-[#1a2035] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-[#1a2035]">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" /> Credenciales — {editingOp.alias}
              </h2>
              <button onClick={() => setIsEditModal(false)} className="text-slate-500 hover:text-red-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditCreds} className="p-6 space-y-4">
              {[
                { label: 'Nuevo Email (opcional)',       key: 'email',    type: 'email',    placeholder: editingOp.email || 'sin email' },
                { label: 'Nueva Contraseña (opcional)',  key: 'password', type: 'password', placeholder: 'Deja vacío para no cambiar' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">{f.label}</label>
                  <input
                    type={f.type} placeholder={f.placeholder}
                    value={(editCredsForm as any)[f.key]}
                    onChange={e => setEditCredsForm({ ...editCredsForm, [f.key]: e.target.value })}
                    className="w-full bg-[#07090f] border border-[#1a2035] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                  />
                </div>
              ))}
              <button disabled={saving} className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-white font-black py-3 rounded-xl text-sm uppercase tracking-wider transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</> : <><Key className="w-4 h-4" /> Actualizar Accesos</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
