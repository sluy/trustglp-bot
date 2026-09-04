'use client';
import { useState, useEffect } from 'react';
import { Users, UserPlus, Key, DollarSign, Activity, Settings2, ShieldCheck, Zap, Edit2, Trash2, Check, X, Share2, Download, QrCode, Rocket, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

export default function CommunityPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [trend, setTrend] = useState('ESCANEO PENDIENTE');
  const [indexData, setIndexData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    alias: '',
    email: '',
    password: '',
    btcCapitalAllocated: '',
    ethCapitalAllocated: '',
    solCapitalAllocated: '',
    xrpCapitalAllocated: '',
    bnbCapitalAllocated: '',
    indexCapitalAllocated: '',
    btcEnabled: true,
    ethEnabled: false,
    solEnabled: false,
    xrpEnabled: false,
    bnbEnabled: false,
    indexEnabled: false,
    apiKey: '',
    apiSecret: '',
    isSimulation: false,
    p2pEnabled: false
  });

  const [saving, setSaving] = useState(false);
  const [editingCapital, setEditingCapital] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ btcCapitalAllocated: '', ethCapitalAllocated: '', solCapitalAllocated: '', xrpCapitalAllocated: '', bnbCapitalAllocated: '', indexCapitalAllocated: '', btcEnabled: true, ethEnabled: false, solEnabled: false, xrpEnabled: false, bnbEnabled: false, indexEnabled: false, p2pEnabled: false, dcaEnabled: false, dcaPct: '20', dcaPendingRestore: '' });
  const [dcaSaving, setDcaSaving] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editCredsForm, setEditCredsForm] = useState({ email: '', password: '' });
  const [shareUser, setShareUser] = useState<any | null>(null);
  const [shareMode, setShareMode] = useState<'TOTAL' | 'BTC' | 'ETH' | 'SOL' | 'XRP' | 'BNB'>('TOTAL');

  const handleDownloadCard = async () => {
    const element = document.getElementById('share-card-element');
    if (!element) return;
    setSaving(true);
    try {
      // @ts-ignore
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(element, { backgroundColor: null, scale: 2 });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `SaaS_PnL_${shareUser.alias}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch(err) {
      console.error(err);
      alert("Error al generar la imagen. ¿Instalaste html2canvas?");
    } finally {
      setSaving(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
      const [res, indexRes] = await Promise.all([
          fetch(`${BASE_URL}/community-users`),
          fetch(`${BASE_URL}/index-fund/dashboard`).catch(() => null)
      ]);
      
      if (res.ok) {
         const data = await res.json();
         if (Array.isArray(data)) {
            setUsers(data);
         } else {
            setUsers(data.users || []);
            if (data.trend) setTrend(data.trend);
         }
      }
      
      if (indexRes && indexRes.ok) {
          const idData = await indexRes.json();
          setIndexData(idData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
      const res = await fetch(`${BASE_URL}/community-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          btcCapitalAllocated: Number(formData.btcCapitalAllocated),
          ethCapitalAllocated: Number(formData.ethCapitalAllocated),
          solCapitalAllocated: Number(formData.solCapitalAllocated),
          xrpCapitalAllocated: Number(formData.xrpCapitalAllocated),
          bnbCapitalAllocated: Number(formData.bnbCapitalAllocated),
          indexCapitalAllocated: Number(formData.indexCapitalAllocated)
        })
      });
      if (res.ok) {
        setFormData({ alias: '', email: '', password: '', btcCapitalAllocated: '', ethCapitalAllocated: '', solCapitalAllocated: '', xrpCapitalAllocated: '', bnbCapitalAllocated: '', btcEnabled: true, ethEnabled: false, solEnabled: false, xrpEnabled: false, bnbEnabled: false, apiKey: '', apiSecret: '', isSimulation: false, indexCapitalAllocated: '', indexEnabled: false, p2pEnabled: false });
        setIsModalOpen(false);
        await fetchUsers();
      } else {
        alert("Fallo estableciendo el usuario.");
      }
    } catch(e) {
      alert("Error contactando al Order Manager API.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditCapital = async (id: number) => {
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
      const res = await fetch(`${BASE_URL}/community-users/${id}/capital`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           btcCapitalAllocated: Number(editForm.btcCapitalAllocated), 
           ethCapitalAllocated: Number(editForm.ethCapitalAllocated),
           solCapitalAllocated: Number(editForm.solCapitalAllocated),
           xrpCapitalAllocated: Number(editForm.xrpCapitalAllocated),
           bnbCapitalAllocated: Number(editForm.bnbCapitalAllocated),
           indexCapitalAllocated: Number(editForm.indexCapitalAllocated),
           btcEnabled: editForm.btcEnabled,
           ethEnabled: editForm.ethEnabled,
           solEnabled: editForm.solEnabled,
           xrpEnabled: editForm.xrpEnabled,
           bnbEnabled: editForm.bnbEnabled,
           indexEnabled: editForm.indexEnabled,
           p2pEnabled: editForm.p2pEnabled,
           dcaEnabled: editForm.dcaEnabled,
           dcaPct: Number(editForm.dcaPct)
        })
      });
      if (res.ok) {
        setEditingCapital(null);
        await fetchUsers();
      } else {
        alert("Fallo actualizando el capital.");
      }
    } catch(e) {
      alert("Error de red al actualizar capital.");
    }
  };

  const handleEditCredentials = async (e: any) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
      const sendData: any = {};
      if (editCredsForm.email) sendData.email = editCredsForm.email;
      if (editCredsForm.password) sendData.password = editCredsForm.password;
      
      const res = await fetch(`${BASE_URL}/community-users/${editingUser.id}/credentials`, { 
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(sendData)
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        setEditingUser(null);
        setEditCredsForm({ email: '', password: '' });
        await fetchUsers();
        alert("Credenciales actualizadas exitosamente.");
      } else {
        alert("Fallo actualizando credenciales.");
      }
    } catch(e) {
      alert("Error de red al actualizar credenciales.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDca = async (userId: number, dcaEnabled: boolean, dcaPct?: number) => {
    setDcaSaving(userId);
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
      await fetch(`${BASE_URL}/community-users/${userId}/dca-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dcaEnabled, dcaPct: dcaPct || 20 })
      });
      await fetchUsers();
    } catch(e) {
      alert('Error actualizando DCA Tesoro BTC');
    } finally {
      setDcaSaving(null);
    }
  };

  const handleRestorePending = async (userId: number) => {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
    const val = Number(editForm.dcaPendingRestore);
    if (isNaN(val) || val < 0) return;
    try {
      await fetch(`${BASE_URL}/community-users/${userId}/dca-pending-admin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingUsdt: val })
      });
      alert(`DCA Pending restaurado a $${val}`);
      await fetchUsers();
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (id: number, alias: string) => {
    if (confirm(`¿Eliminar al agente algorítmico ${alias}? Se destruirán sus métricas operativas al instante. Esto no venderá sus posiciones actuales en Bybit, solo desvinculará al cliente del flujo de trabajo.`)) {
      try {
        const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
        const res = await fetch(`${BASE_URL}/community-users/${id}`, { method: 'DELETE' });
        if (res.ok) {
          await fetchUsers();
        } else {
          alert("Fallo eliminando el usuario.");
        }
      } catch(e) {
        alert("Error de red al borrar.");
      }
    }
  };

  // Para la tarjeta de compartir, mostrar siempre el capital base original y SOLO ganancia cerrada
  let displayRoi = shareUser?.roiPercentage || 0;
  let displayCapital = (shareUser?.capitalAllocated) || 0;   // Ya viene como suma real desde el API
  let displayPnl = shareUser?.realizedPnl || 0;          // Ganancia total cerrada
  let displayLabel = "General";
  
  if (shareUser) {
     if (shareMode === 'BTC') {
         displayRoi = shareUser.btcRoi || 0;
         displayCapital = shareUser.btcCapitalAllocated || 0;
         displayPnl = shareUser.btcRealized ?? shareUser.btcTotalPnl ?? 0;
         displayLabel = "Bitcoin";
     } else if (shareMode === 'ETH') {
         displayRoi = shareUser.ethRoi || 0;
         displayCapital = shareUser.ethCapitalAllocated || 0;
         displayPnl = shareUser.ethRealized ?? shareUser.ethTotalPnl ?? 0;
         displayLabel = "Ethereum";
     } else if (shareMode === 'SOL') {
         displayRoi = shareUser.solRoi || 0;
         displayCapital = shareUser.solCapitalAllocated || 0;
         displayPnl = shareUser.solRealized ?? shareUser.solTotalPnl ?? 0;
         displayLabel = "Solana";
     } else if (shareMode === 'XRP') {
         displayRoi = shareUser.xrpRoi || 0;
         displayCapital = shareUser.xrpCapitalAllocated || 0;
         displayPnl = shareUser.xrpRealized ?? shareUser.xrpTotalPnl ?? 0;
         displayLabel = "XRP";
     }
  }

  // Apalancamiento correcto por par: SOL y XRP = 2x, BTC y ETH = 3x
  const displayLeverage = (shareMode === 'SOL' || shareMode === 'XRP') ? '2x' : '3x';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Comunidad SaaS
          </h1>
          <p className="text-slate-400 mt-2">Arquitectura Quant Multi-Tenant • Red Inversionistas ByBit</p>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 text-white font-semibold px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:scale-105 transition-all">
             <UserPlus className="w-4 h-4" /> Nuevo Cliente
           </button>
           <span className="flex items-center gap-2 text-indigo-400 font-semibold px-5 py-2.5 bg-indigo-500/10 rounded-full border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)] hidden md:flex">
             <Activity className="w-5 h-5 animate-pulse" /> Dispatcher Online
           </span>
        </div>
      </header>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="w-24 h-24 text-blue-400" />
            </div>
            <div className="relative z-10">
                <p className="text-slate-400 text-sm font-medium mb-1">Cuentas Activas</p>
                <h3 className="text-4xl font-black text-white">{users.length}</h3>
            </div>
         </div>
         <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign className="w-24 h-24 text-emerald-400" />
            </div>
            <div className="relative z-10">
                 <p className="text-slate-400 text-sm font-medium mb-1 flex items-center gap-2">Capital Base Depositado <span className="px-1.5 py-0.5 rounded text-[8px] tracking-wider font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/20" title="Capital original inmutable que el cliente depositó">FIJO ORIGINAL</span></p>
                 <h3 className="text-3xl font-black text-emerald-400">
                     ${users.reduce((acc: number, u: any) => acc + Number(u.capitalAllocated), 0).toLocaleString()}
                 </h3>
             </div>
         </div>
         <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity className="w-24 h-24 text-pink-400" />
            </div>
            <div className="relative z-10">
                <p className="text-slate-400 text-sm font-medium mb-1">Pool PNL Total <span className="text-[9px] text-slate-500">(Realizado Cerrado)</span></p>
                <h3 className={`text-3xl font-black ${users.reduce((a: number, u: any) => a + (u.realizedPnl || 0), 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${users.reduce((a: number, u: any) => a + (u.realizedPnl || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h3>
            </div>
         </div>
         <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="w-24 h-24 text-amber-400" />
            </div>
            <div className="relative z-10">
                <div className="flex justify-between items-center mb-1">
                   <p className="text-slate-400 text-sm font-medium">Oráculo Global (BTC)</p>
                   <span className="flex h-3 w-3 relative">
                     {trend !== "ESCANEO PENDIENTE" && (
                         <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${trend === "TENDENCIA_ALCISTA" ? "bg-emerald-400" : trend === "TENDENCIA_BAJISTA" ? "bg-red-400" : "bg-amber-400"}`}></span>
                     )}
                     <span className={`relative inline-flex rounded-full h-3 w-3 ${trend === "TENDENCIA_ALCISTA" ? "bg-emerald-500" : trend === "TENDENCIA_BAJISTA" ? "bg-red-500" : trend === "ESCANEO PENDIENTE" ? "bg-slate-500" : "bg-amber-500"}`}></span>
                   </span>
                </div>
                <h3 className={`text-xl font-black tracking-tight ${trend === "TENDENCIA_ALCISTA" ? "text-emerald-400" : trend === "TENDENCIA_BAJISTA" ? "text-red-400" : trend === "ESCANEO PENDIENTE" ? "text-slate-400" : "text-amber-400"}`}>{trend.replace("_", " ")}</h3>
            </div>
         </div>
      </div>



      {/* ADD USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-950/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <UserPlus className="text-indigo-400" /> Alta de Cliente SaaS
              </h2>
              <button disabled={saving} onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-400 transition-colors"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Alias / Inversor</label>
                <input required type="text" value={formData.alias} onChange={(e: any)=>setFormData({...formData, alias: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="Ej. CryptoShark99" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Email (Opcional)</label>
                <input type="email" value={formData.email} onChange={(e: any)=>setFormData({...formData, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="inversor@email.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Contraseña Portal (Requerido)</label>
                <input required type="password" value={formData.password} onChange={(e: any)=>setFormData({...formData, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="flex items-center gap-2 text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wider">
                       <input type="checkbox" checked={formData.btcEnabled} onChange={(e: any)=>setFormData({...formData, btcEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 text-orange-500 focus:ring-orange-500" />
                       BOT Futuros BTC 3X
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"><DollarSign className="h-3 w-3 text-slate-500" /></div>
                      <input disabled={!formData.btcEnabled} required={formData.btcEnabled} type="number" step="0.01" value={formData.btcCapitalAllocated} onChange={(e: any)=>setFormData({...formData, btcCapitalAllocated: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50" placeholder="Cap BTC" />
                    </div>
                 </div>
                 <div>
                    <label className="flex items-center gap-2 text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wider">
                       <input type="checkbox" checked={formData.ethEnabled} onChange={(e: any)=>setFormData({...formData, ethEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500" />
                       BOT Futuros ETH 3X
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"><DollarSign className="h-3 w-3 text-slate-500" /></div>
                      <input disabled={!formData.ethEnabled} required={formData.ethEnabled} type="number" step="0.01" value={formData.ethCapitalAllocated} onChange={(e: any)=>setFormData({...formData, ethCapitalAllocated: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" placeholder="Cap ETH" />
                    </div>
                 </div>
                 <div>
                    <label className="flex items-center gap-2 text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wider">
                       <input type="checkbox" checked={formData.solEnabled} onChange={(e: any)=>setFormData({...formData, solEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 text-teal-400 focus:ring-teal-400" />
                       BOT Futuros SOL 2X
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"><DollarSign className="h-3 w-3 text-slate-500" /></div>
                      <input disabled={!formData.solEnabled} required={formData.solEnabled} type="number" step="0.01" value={formData.solCapitalAllocated} onChange={(e: any)=>setFormData({...formData, solCapitalAllocated: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50" placeholder="Cap SOL" />
                    </div>
                 </div>
                 <div>
                    <label className="flex items-center gap-2 text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wider">
                       <input type="checkbox" checked={formData.xrpEnabled} onChange={(e: any)=>setFormData({...formData, xrpEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 text-sky-400 focus:ring-sky-400" />
                       BOT Futuros XRP 2X
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"><DollarSign className="h-3 w-3 text-slate-500" /></div>
                      <input disabled={!formData.xrpEnabled} required={formData.xrpEnabled} type="number" step="0.01" value={formData.xrpCapitalAllocated} onChange={(e: any)=>setFormData({...formData, xrpCapitalAllocated: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50" placeholder="Cap XRP" />
                    </div>
                 </div>
                 <div>
                    <label className="flex items-center gap-2 text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wider">
                       <input type="checkbox" checked={formData.indexEnabled} onChange={(e: any)=>setFormData({...formData, indexEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 text-pink-500 focus:ring-pink-500" />
                       Índice SPOT Pasivo
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"><DollarSign className="h-3 w-3 text-slate-500" /></div>
                      <input disabled={!formData.indexEnabled} required={formData.indexEnabled} type="number" step="0.01" value={formData.indexCapitalAllocated} onChange={(e: any)=>setFormData({...formData, indexCapitalAllocated: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50" placeholder="Cap Index" />
                    </div>
                 </div>
                 <div>
                    <label className="flex items-center gap-2 text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wider">
                       <input type="checkbox" checked={formData.p2pEnabled} onChange={(e: any)=>setFormData({...formData, p2pEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-purple-500" />
                       P2P Command Market
                    </label>
                 </div>
              </div>
              
              <div className="pt-2 border-t border-slate-800/50 mt-2">
                 <label className="flex flex-col gap-1 text-sm font-bold text-slate-300">
                    <span className="flex items-center gap-2">
                       <input type="checkbox" checked={formData.isSimulation} onChange={(e: any)=>setFormData({...formData, isSimulation: e.target.checked})} className="rounded bg-slate-900 border-slate-700 w-4 h-4 text-purple-500 focus:ring-purple-500" />
                       Habilitar Paper Trading (Simulación Cero-Riesgo)
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal ml-6">El robot operará virtualmente sin conectar al exchange.</span>
                 </label>
              </div>

              <div className={`pt-2 border-t border-slate-800/50 mt-2 transition-opacity ${formData.isSimulation ? 'opacity-30 pointer-events-none' : ''}`}>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">API Key (ByBit)</label>
                <input required={!formData.isSimulation} disabled={formData.isSimulation} type="text" value={formData.apiKey} onChange={(e: any)=>setFormData({...formData, apiKey: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="xxxx..." />
              </div>
              <div className={`transition-opacity ${formData.isSimulation ? 'opacity-30 pointer-events-none' : ''}`}>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">API Secret (ByBit)</label>
                <input required={!formData.isSimulation} disabled={formData.isSimulation} type="password" value={formData.apiSecret} onChange={(e: any)=>setFormData({...formData, apiSecret: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="••••••••••••••••" />
                <p className="text-[10px] text-emerald-500 mt-2 flex items-center gap-1"><ShieldCheck size={12}/> Secretos encriptados en Base de Datos vía AES-256</p>
              </div>

              <button disabled={saving} className="w-full mt-6 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all flex justify-center items-center gap-2">
                {saving ? "Registrando Nodo..." : <><Settings2 size={18}/> Desplegar Alumno en B2B</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CREDENTIALS MODAL */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-950/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Key className="text-amber-400" /> Credenciales de {editingUser.alias}
              </h2>
              <button disabled={saving} onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-red-400 transition-colors"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleEditCredentials} className="p-6 space-y-4">
              <p className="text-xs text-slate-400 mb-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 leading-relaxed">
                 <span className="text-amber-400 font-bold block mb-1">Capa de Seguridad Híbrida:</span>
                 Al generar una nueva contraseña provisoria, el sistema obligará automáticamente al inversor a <b>cambiarla por una propia</b> en su próximo Login.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Nuevo Email (Opcional)</label>
                <input type="email" value={editCredsForm.email} onChange={(e: any)=>setEditCredsForm({...editCredsForm, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all" placeholder={editingUser.email || "inversor@email.com"} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Nueva Contraseña Provisoria</label>
                <input type="password" value={editCredsForm.password} onChange={(e: any)=>setEditCredsForm({...editCredsForm, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all" placeholder="Escribe para reemplazar..." />
              </div>
              <button disabled={saving} className="w-full mt-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all flex justify-center items-center gap-2">
                {saving ? "Guardando..." : <><Key size={18}/> Actualizar Accesos</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SHARE CARD MODAL */}
      {shareUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
           <div className="flex flex-col items-center max-w-full">
              
              <div className="w-full flex justify-end mb-4">
                 <button onClick={() => setShareUser(null)} className="text-white hover:text-red-400 transition bg-slate-900 rounded-full p-2 border border-slate-700 shadow-xl"><X size={24}/></button>
              </div>

              {/* TICKET WRAPPER */}
              <div id="share-card-element" className="bg-[#0b0e14] text-white w-[500px] max-w-[95vw] rounded-[24px] relative overflow-hidden flex flex-col border border-slate-800/80 shadow-2xl" style={{ minHeight: '420px', backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.15), transparent 50%), radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.1), transparent 50%)' }}>
                 
                 {/* GRID BACKGROUND EFFECT */}
                 <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 1) 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

                 {/* ROCKET ICON BG */}
                 <div className="absolute right-[-30px] bottom-32 z-0 opacity-[0.06] rotate-[20deg]">
                    <Rocket size={320} className="text-emerald-400" strokeWidth={1} />
                 </div>

                 <div className="relative z-10 w-full p-10 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-10">
                       <div className="font-black text-3xl tracking-tighter text-white flex items-center">
                          JARVIS<span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 ml-1 rounded-md text-2xl">.AI</span>
                       </div>
                       <span className="text-emerald-400/80 font-mono text-[10px] border border-emerald-500/20 px-2 py-1 rounded bg-emerald-500/10 uppercase tracking-widest mt-1">Autonomous Quant</span>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-4">
                       <h1 className="text-4xl font-extrabold tracking-tight drop-shadow-xl">{shareUser.alias}</h1>
                       <span className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1 rounded-[4px] text-xs font-bold shadow-lg">Long {displayLeverage} • {displayLabel}</span>
                    </div>

                    <div className="mb-10 relative">
                       <p className="text-slate-400 text-xs mb-2 uppercase tracking-widest font-semibold flex items-center gap-1.5">ROI P&L ({displayLabel}) <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]"></span></p>
                       <h2 className={`text-[4.5rem] leading-none font-black tracking-tighter ${displayRoi >= 0 ? "text-emerald-400" : "text-red-400"}`} style={{ textShadow: displayRoi >= 0 ? '0 0 60px rgba(52,211,153,0.3)' : '0 0 60px rgba(248,113,113,0.3)' }}>
                         {displayRoi >= 0 ? "+" : ""}{displayRoi.toFixed(2)}%
                       </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-6 mt-auto">
                       <div>
                          <p className="text-slate-400 text-[10px] mb-1.5 uppercase tracking-widest font-bold">Capital Operativo</p>
                          <p className="text-xl font-bold text-white tracking-tight">${Number(displayCapital).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                       </div>
                       <div>
                          <p className="text-slate-400 text-[10px] mb-1.5 uppercase tracking-widest font-bold">Ganancia Realizada</p>
                          <p className={`text-xl font-bold tracking-tight ${displayPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                             {displayPnl >= 0 ? "+" : "-"} ${Math.abs(displayPnl || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </p>
                       </div>
                    </div>
                 </div>

                 {/* FOOTER BAR */}
                 <div className="relative w-full bg-slate-100 text-slate-900 px-8 py-5 flex justify-between items-center z-20 mt-auto">
                    <div>
                      <p className="text-xs font-bold mb-1 text-slate-500">Comunidad Privada de Inteligencia Artificial</p>
                      <p className="text-xl font-black uppercase tracking-tight">VIP Pool Inversionistas</p>
                    </div>
                    <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-300">
                      <QrCode size={45} className="text-slate-800" strokeWidth={1.5} />
                    </div>
                 </div>
              </div>

              {/* ACTION BUTTON */}
              <button 
                 onClick={handleDownloadCard} 
                 disabled={saving}
                 className="mt-8 flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white px-8 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] hover:scale-105 transition-all outline-none">
                 {saving ? "Procesando Imagen..." : <><Download size={20} /> Descargar Tarjeta JPG</>}
              </button>
           </div>
        </div>
      )}

      <div className="w-full">
        
        {/* USERS TABLE */}
        <div className="w-full">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-0 overflow-hidden shadow-2xl h-full">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="text-blue-400" /> Pool de Inversionistas
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-500 animate-pulse">Sincronizando Orquestador...</div>
              ) : users.length === 0 ? (
                <div className="p-12 text-center">
                  <Key className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-400">Sin Agentes Activos</h3>
                  <p className="text-slate-500 text-sm mt-1">Registra tu primer cliente para iniciar la distribución de Señales HMM.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <th className="p-4 font-medium">Alias</th>
                      <th className="p-4 font-medium">Estado Algorítmico</th>
                      <th className="p-4 font-medium">Capital Protegido</th>
                      <th className="p-4 font-medium text-right">PyG Realizado (ROI)</th>
                      <th className="p-4 font-medium text-right">PyG Flotante</th>
                      <th className="p-4 font-medium text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.map((u: any) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white tracking-wide">{u.alias}</div>
                          <div className="text-xs text-slate-500">{u.email || 'N/A'}</div>
                        </td>
                        <td className="p-4">
                          {u.status === 'ACTIVE' ? (
                            u.isSimulation ? (
                               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                 <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Simulación
                               </span>
                            ) : (
                               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Despachando
                               </span>
                            )
                          ): (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Pausado
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {editingCapital === u.id ? (
                             <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                   <input type="checkbox" checked={editForm.btcEnabled} onChange={(e:any)=>setEditForm({...editForm, btcEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 w-3 h-3" />
                                   <span className="text-[10px] text-orange-400 font-bold w-6">BTC</span>
                                   <input type="number" disabled={!editForm.btcEnabled} className="bg-slate-950 border border-slate-700 w-20 p-1 text-xs rounded text-white" value={editForm.btcCapitalAllocated} onChange={(e: any) => setEditForm({...editForm, btcCapitalAllocated: e.target.value})} />
                                </div>
                                <div className="flex items-center gap-2">
                                   <input type="checkbox" checked={editForm.ethEnabled} onChange={(e:any)=>setEditForm({...editForm, ethEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 w-3 h-3 text-indigo-500 focus:ring-indigo-500" />
                                   <span className="text-[10px] text-indigo-400 font-bold w-6">ETH</span>
                                   <input type="number" disabled={!editForm.ethEnabled} className="bg-slate-950 border border-slate-700 w-20 p-1 text-xs rounded text-white" value={editForm.ethCapitalAllocated} onChange={(e: any) => setEditForm({...editForm, ethCapitalAllocated: e.target.value})} />
                                </div>
                                <div className="flex items-center gap-2">
                                   <input type="checkbox" checked={editForm.solEnabled} onChange={(e:any)=>setEditForm({...editForm, solEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 w-3 h-3 text-teal-400 focus:ring-teal-400" />
                                   <span className="text-[10px] text-teal-400 font-bold w-6">SOL</span>
                                   <input type="number" disabled={!editForm.solEnabled} className="bg-slate-950 border border-slate-700 w-20 p-1 text-xs rounded text-white" value={editForm.solCapitalAllocated} onChange={(e: any) => setEditForm({...editForm, solCapitalAllocated: e.target.value})} />
                                </div>
                                <div className="flex items-center gap-2">
                                   <input type="checkbox" checked={editForm.xrpEnabled} onChange={(e:any)=>setEditForm({...editForm, xrpEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 w-3 h-3 text-sky-400 focus:ring-sky-400" />
                                   <span className="text-[10px] text-sky-400 font-bold w-6">XRP</span>
                                   <input type="number" disabled={!editForm.xrpEnabled} className="bg-slate-950 border border-slate-700 w-20 p-1 text-xs rounded text-white" value={editForm.xrpCapitalAllocated} onChange={(e: any) => setEditForm({...editForm, xrpCapitalAllocated: e.target.value})} />
                                </div>
                                 <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={editForm.bnbEnabled} onChange={(e:any)=>setEditForm({...editForm, bnbEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 w-3 h-3 text-yellow-400 focus:ring-yellow-400" />
                                    <span className="text-[10px] text-yellow-400 font-bold w-6">BNB</span>
                                    <input type="number" disabled={!editForm.bnbEnabled} className="bg-slate-950 border border-slate-700 w-20 p-1 text-xs rounded text-white" value={editForm.bnbCapitalAllocated} onChange={(e: any) => setEditForm({...editForm, bnbCapitalAllocated: e.target.value})} />
                                 </div>
                                <div className="flex items-center gap-2">
                                   <input type="checkbox" checked={editForm.indexEnabled} onChange={(e:any)=>setEditForm({...editForm, indexEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 w-3 h-3 text-pink-500 focus:ring-pink-500" />
                                   <span className="text-[10px] text-pink-400 font-bold w-6">IDX</span>
                                   <input type="number" disabled={!editForm.indexEnabled} className="bg-slate-950 border border-slate-700 w-20 p-1 text-xs rounded text-white" value={editForm.indexCapitalAllocated} onChange={(e: any) => setEditForm({...editForm, indexCapitalAllocated: e.target.value})} />
                                </div>
                                <div className="flex items-center gap-2 mt-1 px-1">
                                   <input type="checkbox" checked={editForm.p2pEnabled} onChange={(e:any)=>setEditForm({...editForm, p2pEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 w-3 h-3 text-purple-500 focus:ring-purple-500" />
                                   <span className="text-[10px] text-purple-400 font-bold w-full uppercase">P2P Command Market</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 px-1 border-t border-slate-700 pt-2">
                                    <input type="checkbox" checked={editForm.dcaEnabled} onChange={(e:any)=>setEditForm({...editForm, dcaEnabled: e.target.checked})} className="rounded bg-slate-900 border-slate-700 w-3 h-3 text-orange-500 focus:ring-orange-500" />
                                    <span className="text-[10px] text-orange-400 font-bold">₿ Tesoro BTC DCA</span>
                                    <input type="number" min="5" max="50" step="1" className="bg-slate-950 border border-slate-700 w-12 p-0.5 text-[10px] rounded text-orange-300 text-center" value={editForm.dcaPct} onChange={(e:any)=>setEditForm({...editForm, dcaPct: e.target.value})} />
                                    <span className="text-[10px] text-slate-500">%</span>
                                </div>
                                <div className="flex items-center gap-1 mt-1 px-1">
                                    <span className="text-[9px] text-slate-600 uppercase tracking-widest">Pending $</span>
                                    <input type="number" min="0" step="0.01" placeholder={`actual: $${Number(u.dcaPendingUsdt||0).toFixed(2)}`} className="bg-slate-950 border border-amber-500/30 w-20 p-0.5 text-[10px] rounded text-amber-300 text-center placeholder:text-slate-700" value={editForm.dcaPendingRestore} onChange={(e:any)=>setEditForm({...editForm, dcaPendingRestore: e.target.value})} />
                                    <button onClick={() => handleRestorePending(u.id)} className="text-amber-400 hover:scale-110 text-[9px] border border-amber-500/30 px-1 py-0.5 rounded">↺ Restaurar</button>
                                </div>
                                <div className="flex gap-3 justify-center mt-1 border-t border-slate-700 pt-2">
                                    <button onClick={() => handleEditCapital(u.id)} className="text-emerald-400 hover:scale-110 flex items-center gap-1 text-[10px]"><Check size={12}/> Guardar</button>
                                    <button onClick={() => setEditingCapital(null)} className="text-red-400 hover:scale-110 flex items-center gap-1 text-[10px]"><X size={12}/> Cerrar</button>
                                </div>
                             </div>
                          ) : (
                             <div className="font-mono text-white flex flex-col gap-1 group cursor-pointer" onClick={() => {setEditingCapital(u.id); setEditForm({btcCapitalAllocated: u.btcCapitalAllocated.toString(), ethCapitalAllocated: u.ethCapitalAllocated.toString(), solCapitalAllocated: (u.solCapitalAllocated||0).toString(), xrpCapitalAllocated: (u.xrpCapitalAllocated||0).toString(), bnbCapitalAllocated: (u.bnbCapitalAllocated||0).toString(), indexCapitalAllocated: (u.indexCapitalAllocated||0).toString(), btcEnabled: u.btcEnabled, ethEnabled: u.ethEnabled, solEnabled: u.solEnabled, xrpEnabled: u.xrpEnabled, bnbEnabled: u.bnbEnabled||false, indexEnabled: u.indexEnabled, p2pEnabled: u.p2pEnabled, dcaEnabled: u.dcaEnabled||false, dcaPct: (u.dcaPct||20).toString()})}}>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><DollarSign size={12} className="-mr-1"/> BASE: <span className="text-white text-sm">${Number(u.capitalAllocated).toLocaleString('en-US')}</span> <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-indigo-400"/></div>
                                <div className="flex gap-1 flex-wrap">
                                   {u.btcEnabled && <div className="text-[10px] text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded border border-orange-400/20 max-w-max">BTC: ${Number(u.btcCapitalAllocated).toLocaleString()}</div>}
                                   {u.ethEnabled && <div className="text-[10px] text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded border border-indigo-400/20 max-w-max">ETH: ${Number(u.ethCapitalAllocated).toLocaleString()}</div>}
                                   {u.solEnabled && <div className="text-[10px] text-teal-400 bg-teal-400/10 px-1.5 py-0.5 rounded border border-teal-400/20 max-w-max">SOL: ${Number(u.solCapitalAllocated).toLocaleString()}</div>}
                                   {u.xrpEnabled && <div className="text-[10px] text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded border border-sky-400/20 max-w-max">XRP: ${Number(u.xrpCapitalAllocated).toLocaleString()}</div>}
                                   {u.bnbEnabled && <div className="text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/20 max-w-max">BNB: ${Number(u.bnbCapitalAllocated).toLocaleString()}</div>}
                                   {u.indexEnabled && <div className="text-[10px] text-pink-400 bg-pink-400/10 px-1.5 py-0.5 rounded border border-pink-400/20 max-w-max">IDX: ${Number(u.indexCapitalAllocated).toLocaleString()}</div>}
                                   {u.p2pEnabled && <div className="text-[10px] text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20 max-w-max">P2P</div>}
                                   {u.dcaEnabled && <div className="text-[10px] text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded border border-orange-400/20 max-w-max flex items-center gap-1">₿ DCA {u.dcaPct||20}%</div>}
                                </div>
                             </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className={`text-md font-bold ${u.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                             {u.realizedPnl >= 0 ? '+' : ''}{u.realizedPnl?.toFixed(2) || '0.00'} <span className="text-[10px] text-slate-400 font-normal">USDT</span>
                          </div>
                          <div className="flex flex-col items-end gap-1 mt-1">
                              {u.btcEnabled && <div onClick={() => { setShareUser(u); setShareMode('BTC'); }} className={`cursor-pointer hover:bg-slate-800 transition-colors hover:scale-105 text-[9px] font-mono whitespace-nowrap bg-slate-950 px-1.5 py-0.5 rounded border ${u.btcRoi >= 0 ? 'text-emerald-400 border-emerald-500/20' : 'text-red-400 border-red-500/20'}`}>BTC ROI: {u.btcRoi >= 0 ? '+' : ''}{(u.btcRoi||0).toFixed(2)}% (${(u.btcRealized||0).toFixed(2)})</div>}
                              {u.ethEnabled && <div onClick={() => { setShareUser(u); setShareMode('ETH'); }} className={`cursor-pointer hover:bg-slate-800 transition-colors hover:scale-105 text-[9px] font-mono whitespace-nowrap bg-slate-950 px-1.5 py-0.5 rounded border ${u.ethRoi >= 0 ? 'text-emerald-400 border-emerald-500/20' : 'text-red-400 border-red-500/20'}`}>ETH ROI: {u.ethRoi >= 0 ? '+' : ''}{(u.ethRoi||0).toFixed(2)}% (${(u.ethRealized||0).toFixed(2)})</div>}
                              {u.solEnabled && <div onClick={() => { setShareUser(u); setShareMode('SOL'); }} className={`cursor-pointer hover:bg-slate-800 transition-colors hover:scale-105 text-[9px] font-mono whitespace-nowrap bg-slate-950 px-1.5 py-0.5 rounded border ${u.solRoi >= 0 ? 'text-emerald-400 border-emerald-500/20' : 'text-red-400 border-red-500/20'}`}>SOL ROI: {u.solRoi >= 0 ? '+' : ''}{(u.solRoi||0).toFixed(2)}% (${(u.solRealized||0).toFixed(2)})</div>}
                              {u.xrpEnabled && <div onClick={() => { setShareUser(u); setShareMode('XRP'); }} className={`cursor-pointer hover:bg-slate-800 transition-colors hover:scale-105 text-[9px] font-mono whitespace-nowrap bg-slate-950 px-1.5 py-0.5 rounded border ${u.xrpRoi >= 0 ? 'text-emerald-400 border-emerald-500/20' : 'text-red-400 border-red-500/20'}`}>XRP ROI: {u.xrpRoi >= 0 ? '+' : ''}{(u.xrpRoi||0).toFixed(2)}% (${(u.xrpRealized||0).toFixed(2)})</div>}
                               {u.bnbEnabled && <div onClick={() => { setShareUser(u); setShareMode('BNB'); }} className={`cursor-pointer hover:bg-slate-800 transition-colors hover:scale-105 text-[9px] font-mono whitespace-nowrap bg-slate-950 px-1.5 py-0.5 rounded border ${u.bnbRoi >= 0 ? 'text-emerald-400 border-emerald-500/20' : 'text-red-400 border-red-500/20'}`}>BNB ROI: {u.bnbRoi >= 0 ? '+' : ''}{(u.bnbRoi||0).toFixed(2)}% (${(u.bnbRealized||0).toFixed(2)})</div>}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                           <div className={`text-md font-bold ${u.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {u.unrealizedPnl >= 0 ? '+' : ''}{u.unrealizedPnl?.toFixed(2) || '0.00'} <span className="text-xs text-slate-400 font-normal">USDT</span>
                           </div>
                           <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">
                              Equity Real: ${u.currentEquity?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}
                           </div>
                           <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
                              ({u.currentEquity >= u.capitalAllocated ? '+' : ''}{((u.currentEquity || 0) - (u.capitalAllocated || 0)).toFixed(2)} neto)
                           </div>
                        </td>
                        <td className="p-4 flex gap-1 items-center justify-center">
                           <button onClick={() => { setEditingUser(u); setEditCredsForm({email: '', password: ''}); setIsEditModalOpen(true); }} className="text-amber-400 hover:text-amber-300 transition-colors p-2 rounded-lg hover:bg-slate-800/50" title="Editar Credenciales y Clave">
                              <Key size={16}/>
                           </button>
                           <button onClick={() => { setShareUser(u); setShareMode('TOTAL'); }} className="text-indigo-400 hover:text-indigo-300 transition-colors p-2 rounded-lg hover:bg-slate-800/50" title="Compartir Tarjeta VIP">
                              <Share2 size={16}/>
                           </button>
                           <button onClick={() => handleDeleteUser(u.id, u.alias)} className="text-slate-600 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-slate-800/50" title="Eliminar Inversor (Kill Switch)">
                              <Trash2 size={16}/>
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
