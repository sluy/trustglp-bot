'use client';
import { useEffect, useState } from 'react';
import { Bitcoin, TrendingUp, Sparkles, Clock, History, ChevronRight, Lock, Zap } from 'lucide-react';

interface DcaHistoryItem {
  id: number;
  usdtSpent: number;
  btcBought: number;
  btcPrice: number;
  earnStaked: boolean;
  date: string;
}

interface DcaDashboardData {
  success: boolean;
  dcaEnabled: boolean;
  dcaPct: number;
  btcAccumulated: number;
  btcCurrentPrice: number;
  btcValueUsdt: number;
  avgBuyPrice: number;
  unrealizedPnlPct: number;
  totalUsdtInvested: number;
  earnYieldUsdt: number;
  pendingUsdt: number;
  weeklyProfit: number;
  weeklyDcaAmount: number;
  weekStart: string;
  weekEnd: string;
  dcaMinTrigger: number;
  history: DcaHistoryItem[];
}

interface Props {
  token: string;
  apiBase: string;
}

export function TesoroBtcDashboard({ token, apiBase }: Props) {
  const [data, setData] = useState<DcaDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDca = async () => {
      try {
        const res = await fetch(`${apiBase}/community-users/me/dca-dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error('Error fetching DCA dashboard', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDca();
  }, [token, apiBase]);

  // Calcular días al próximo lunes
  const daysToNextMonday = () => {
    const now = new Date();
    const day = now.getDay(); // 0=Dom, 1=Lun...
    const diff = day === 1 ? 7 : (8 - day) % 7;
    return diff;
  };

  if (loading) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl p-8 border border-white/5 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.success || !data.dcaEnabled) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl p-8 border border-amber-500/10 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Bitcoin className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="font-black text-white text-lg uppercase tracking-widest">Tesoro BTC</h3>
            <p className="text-slate-500 text-xs">Acumulación automática desde ganancias del Grid</p>
          </div>
          <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-widest">
            No Activado
          </span>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 flex items-start gap-4">
          <Lock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-slate-400 text-sm leading-relaxed">
            El <span className="text-amber-400 font-bold">Tesoro BTC</span> desvía automáticamente el {' '}
            <span className="text-white font-bold">20% de las ganancias semanales del Grid</span> hacia compras DCA de Bitcoin
            en Spot. El BTC comprado se deposita en <span className="text-amber-400 font-bold">Bybit Earn</span> para generar
            yield adicional. Habla con tu asesor para activarlo.
          </p>
        </div>
      </div>
    );
  }

  const isProfit = data.unrealizedPnlPct >= 0;
  const pendingPct = data.dcaMinTrigger > 0 ? Math.min(100, (data.pendingUsdt / data.dcaMinTrigger) * 100) : 0;
  const daysLeft = daysToNextMonday();
  const nextDcaReady = data.pendingUsdt >= data.dcaMinTrigger;

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="relative px-6 pt-6 pb-5 border-b border-white/5 overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <Bitcoin className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="font-black text-white text-lg tracking-widest uppercase flex items-center gap-2">
              Tesoro BTC
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            </h3>
            <p className="text-slate-500 text-xs">DCA Automático {data.dcaPct}% ganancias Grid → Spot → Earn</p>
          </div>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5">
        {/* BTC Acumulado */}
        <div className="bg-slate-950/60 p-5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">BTC Acumulado</p>
          <p className="text-2xl font-black text-amber-400 tracking-tighter">
            {data.btcAccumulated.toFixed(8)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            ≈ ${data.btcValueUsdt.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Precio Promedio */}
        <div className="bg-slate-950/60 p-5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Precio Promedio</p>
          <p className="text-2xl font-black text-white tracking-tighter">
            ${data.avgBuyPrice > 0 ? data.avgBuyPrice.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}
          </p>
          <p className={`text-[11px] mt-1 font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isProfit ? '▲' : '▼'} {Math.abs(data.unrealizedPnlPct).toFixed(2)}% vs precio actual
          </p>
        </div>

        {/* Earn Yield */}
        <div className="bg-slate-950/60 p-5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" /> Yield Earn (est.)
          </p>
          <p className="text-2xl font-black text-purple-400 tracking-tighter">
            +${data.earnYieldUsdt.toFixed(2)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">≈ 1.5% APY en BTC</p>
        </div>

        {/* Total Invertido */}
        <div className="bg-slate-950/60 p-5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">USDT Invertido</p>
          <p className="text-2xl font-black text-slate-200 tracking-tighter">
            ${data.totalUsdtInvested.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {data.history.length} compra{data.history.length !== 1 ? 's' : ''} realizadas
          </p>
        </div>
      </div>

      {/* DCA Progress Bar */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              Próxima Compra DCA
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {daysLeft === 0
              ? <span className="text-amber-400 font-bold animate-pulse">🔥 Ejecución hoy</span>
              : `Lunes en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Monto acumulado — prominente siempre */}
        <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-3 border ${
          nextDcaReady
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-slate-800/60 border-slate-700/50'
        }`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
              {nextDcaReady ? '✅ Listo para ejecutar el lunes' : 'Ganancia esta semana'}
            </p>
            {/* Desglose: ganancia semana → 20% → DCA */}
            {data.weeklyProfit > 0 ? (
              <div className="flex items-baseline gap-2">
                <p className={`text-2xl font-black tracking-tighter ${nextDcaReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                  ${(data.weeklyDcaAmount ?? data.pendingUsdt).toFixed(2)}
                  <span className="text-sm font-normal text-slate-500 ml-1">USDT</span>
                </p>
                <span className="text-[10px] text-slate-500">
                  ({data.dcaPct}% de ${data.weeklyProfit.toFixed(2)})
                </span>
              </div>
            ) : (
              <p className={`text-2xl font-black tracking-tighter ${nextDcaReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                ${(data.weeklyDcaAmount ?? data.pendingUsdt).toFixed(2)}
                <span className="text-sm font-normal text-slate-500 ml-1">USDT</span>
              </p>
            )}
            {data.weekStart && (
              <p className="text-[10px] text-slate-600 mt-0.5">
                {data.weekStart} → {data.weekEnd}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 mb-0.5">Objetivo</p>
            <p className="text-lg font-black text-slate-400">${data.dcaMinTrigger}</p>
            {nextDcaReady && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold mt-1">
                <Zap className="w-3 h-3" /> Compra programada
              </span>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pendingPct}%`,
              background: pendingPct >= 100
                ? 'linear-gradient(90deg, #f59e0b, #10b981)'
                : 'linear-gradient(90deg, #f59e0b55, #f59e0b)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <p className="text-[10px] text-slate-500">
            Acumulando {data.dcaPct}% de las ganancias semanales
          </p>
          <p className="text-[10px] text-slate-500 font-mono">
            {pendingPct.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* BTC Price Live */}
      {data.btcCurrentPrice > 0 && (
        <div className="px-6 py-3 bg-amber-500/5 border-b border-amber-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-300 font-bold uppercase tracking-widest">BTC/USDT en tiempo real</span>
          </div>
          <span className="font-black text-amber-400 text-lg tracking-tighter">
            ${data.btcCurrentPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}

      {/* History */}
      {data.history.length > 0 && (
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Historial de Compras DCA</h4>
          </div>
          <div className="space-y-2">
            {data.history.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-slate-800/40 hover:bg-slate-800/70 rounded-xl px-4 py-3 border border-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Bitcoin className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white font-mono">
                      +{item.btcBought.toFixed(8)} <span className="text-amber-400">BTC</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(item.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-300">${item.usdtSpent.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">@ ${item.btcPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  {item.earnStaked ? (
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Earn
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full text-[10px]">Spot</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
          {data.history.length > 5 && (
            <p className="text-center text-xs text-slate-600 mt-3">
              + {data.history.length - 5} compras anteriores
            </p>
          )}
        </div>
      )}

      {/* Empty history */}
      {data.history.length === 0 && (
        <div className="px-6 py-8 text-center">
          <Bitcoin className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">Aún no hay compras DCA ejecutadas</p>
          <p className="text-slate-600 text-xs mt-1">
            Las compras se ejecutan automáticamente cada lunes cuando acumulas ≥$100
          </p>
        </div>
      )}
    </div>
  );
}
