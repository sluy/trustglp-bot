'use client';

import { useState, useEffect } from 'react';
import { isFrankTheme, isRafaTheme, isJarvisTheme } from '../../../lib/theme';
import { IS_DEMO } from '../../../lib/demoMode';
import { demoRadarConfigs, demoMarketData } from '../../../lib/demoData';
import RadarCard from './components/RadarCard';
import { RadarConfig } from '../../api/config/radar/route';
import { Plus, X, Radar } from 'lucide-react';
import { io } from 'socket.io-client';

const BYBIT_METHODS = [
  { id: '137', name: 'Banesco (137)' },
  { id: '316', name: 'Mercantil (316)' },
  { id: '130', name: 'Pago Móvil (130)' },
  { id: '315', name: 'BBVA Provincial (315)' },
  { id: '317', name: 'Banco de Venezuela (317)' },
  { id: '321', name: 'Bancamiga (321)' },
];

const BINANCE_METHODS = [
  { id: 'Banesco', name: 'Banesco' },
  { id: 'Mercantil', name: 'Mercantil' },
  { id: 'PagoMovil', name: 'Pago Móvil' },
  { id: 'Provincial', name: 'BBVA Provincial' },
  { id: 'BancodeVenezuela', name: 'Banco de Venezuela' },
  { id: 'Bancamiga', name: 'Bancamiga' },
];

export default function RadarPage() {
  const [radars, setRadars] = useState<RadarConfig[]>([]);
  const [marketDataRegistry, setMarketDataRegistry] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [socketStatus, setSocketStatus] = useState('Conectando...');
  const [socketError, setSocketError] = useState('');
  
  // Nuevo radar form
  const [newExchange, setNewExchange] = useState<'binance'|'bybit'>('bybit');
  const [newBank, setNewBank] = useState('137');
  const [newCapitalUsdt, setNewCapitalUsdt] = useState(1000);
  const [newSpreadPct, setNewSpreadPct] = useState(1.5);
  const [newSellAdId, setNewSellAdId] = useState('');
  const [newBuyAdId, setNewBuyAdId] = useState('');
  
  // Custom limits
  const [limitType, setLimitType] = useState<'predefined'|'custom'>('predefined');
  const [customLimit1, setCustomLimit1] = useState(100000);
  const [customLimit2, setCustomLimit2] = useState(50000);
  const [customLimit3, setCustomLimit3] = useState(25000);
  
  // Pricing mode
  const [newPricingMode, setNewPricingMode] = useState<'agresivo'|'neutro'>('agresivo');

  const fetchRadars = async () => {
    if (IS_DEMO) {
      setRadars(demoRadarConfigs.map(r => ({
        id: r.id,
        exchange: r.exchange,
        paymentMethod: r.bank,
        capitalUsdt: r.capitalUsdt,
        vitalSpreadPct: r.spreadPct,
        sellActive: false,
        buyActive: false,
        sellAdId: r.sellAdId,
        buyAdId: r.buyAdId,
        pricingMode: r.pricingMode,
      })));
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/config/radar');
      const data = await res.json();
      if (data.ok) {
        setRadars(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRadars();

    if (IS_DEMO) {
      // In demo mode, populate market data from static demo data every 5s
      const demoKeys = Object.keys(demoMarketData);
      const pushDemoData = () => {
        setMarketDataRegistry(prev => {
          const next = { ...prev };
          demoRadarConfigs.forEach(r => {
            const bankKey = demoKeys.find(k => r.bank.toLowerCase().includes(k.toLowerCase())) || demoKeys[0];
            next[r.id] = demoMarketData[bankKey];
          });
          return next;
        });
        setSocketStatus('Conectado');
        setSocketError('');
      };
      pushDemoData();
      const interval = setInterval(pushDemoData, 5000);
      return () => clearInterval(interval);
    }

    let isSubscribed = true;
    
    const normalizePaymentMethod = (pm: string) => {
      const str = String(pm).toLowerCase();
      if (['14', '137', 'banesco'].some(k => str.includes(k))) return 'Banesco';
      if (['316', 'mercantil'].some(k => str.includes(k))) return 'Mercantil';
      if (['64', '130', '318', '377', '382', '416', 'pago', 'movil'].some(k => str.includes(k))) return 'PagoMovil';
      if (['315', 'provincial', 'bbva'].some(k => str.includes(k))) return 'Provincial';
      if (['317', 'venezuela', 'bdv'].some(k => str.includes(k))) return 'BancodeVenezuela';
      if (['321', 'bancamiga'].some(k => str.includes(k))) return 'Bancamiga';
      return 'Banesco';
    };

    const scanAllRadars = async () => {
      if (!isSubscribed) return;
      try {
        setSocketStatus('Sincronizando...');
        
        // Obtenemos los radares activos
        const res = await fetch('/api/config/radar');
        const data = await res.json();
        const currentRadars: RadarConfig[] = data.data || [];
        
        for (const radar of currentRadars) {
          if (radar.exchange === 'bybit') {
            try {
              const scanRes = await fetch('/api/bybit/p2p-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bank: radar.paymentMethod, capital: radar.capitalUsdt, spread: radar.vitalSpreadPct, customLimits: radar.customLimits, pricingMode: radar.pricingMode })
              });
              if (scanRes.ok) {
                const scanData = await scanRes.json();
                setMarketDataRegistry(prev => ({
                   ...prev,
                   [radar.id]: scanData
                }));
              }
            } catch (err) {
              console.error("Error scanning radar", radar.paymentMethod, err);
            }
          } else if (radar.exchange === 'binance') {
            try {
              const scanRes = await fetch('/api/binance/p2p-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bank: radar.paymentMethod, capital: radar.capitalUsdt, spread: radar.vitalSpreadPct, customLimits: radar.customLimits, pricingMode: radar.pricingMode })
              });
              if (scanRes.ok) {
                const scanData = await scanRes.json();
                setMarketDataRegistry(prev => ({
                   ...prev,
                   [radar.id]: scanData
                }));
              } else {
                let errText = await scanRes.text();
                try {
                  const parsed = JSON.parse(errText);
                  if (parsed.error) errText = parsed.error;
                } catch(e) {}
                
                console.error("Binance scan failed:", scanRes.status, errText);
                setMarketDataRegistry(prev => ({
                   ...prev,
                   [radar.id]: { has_error: true, error_msg: errText }
                }));
              }
            } catch (err) {
              console.error("Error scanning Binance radar", radar.paymentMethod, err);
            }
          }
        }
        
        setSocketStatus('Conectado');
        setSocketError('');
      } catch (err: any) {
        setSocketStatus('Error');
        setSocketError(err.message);
      }
    };

    scanAllRadars();
    const interval = setInterval(scanAllRadars, 45000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);



  const handleAddRadar = async (e: React.FormEvent) => {
    e.preventDefault();
    const newRadar: RadarConfig = {
      id: Date.now().toString(),
      exchange: newExchange,
      paymentMethod: newBank,
      capitalUsdt: newCapitalUsdt,
      vitalSpreadPct: newSpreadPct,
      sellActive: false,
      buyActive: false,
      sellAdId: newSellAdId,
      buyAdId: newBuyAdId,
      customLimits: limitType === 'custom' ? [customLimit1, customLimit2, customLimit3] : undefined,
      pricingMode: newPricingMode,
    };
    if (IS_DEMO) {
      setRadars(prev => [...prev, newRadar]);
      setShowAddModal(false);
      return;
    }
    try {
      const res = await fetch('/api/config/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRadar)
      });
      const data = await res.json();
      if (data.ok) {
        setRadars(data.data);
        setShowAddModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRadar = async (updated: RadarConfig) => {
    try {
      const res = await fetch('/api/config/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (data.ok) {
        setRadars(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRadar = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este Radar?')) return;
    if (IS_DEMO) {
      setRadars(prev => prev.filter(r => r.id !== id));
      return;
    }
    try {
      const res = await fetch(`/api/config/radar?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        setRadars(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Cargando radares...</div>;
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={`text-3xl font-black ${isFrankTheme ? 'text-orange-500' : (isRafaTheme || isJarvisTheme) ? 'text-emerald-500' : 'text-white'}`}>
            Radar Inteligente & Sentinel
          </h1>
          <p className="text-slate-400 text-sm mt-1">Configuración individual de algoritmos Maker para P2P</p>
          <div className="mt-2 text-xs text-slate-500 font-mono">
            Estatus del Scanner P2P Directo: <span className={socketStatus === 'Conectado' ? 'text-emerald-400' : socketStatus === 'Error' ? 'text-red-400' : 'text-amber-400'}>{socketStatus}</span> 
            {socketError && <span className="text-red-400 ml-2">({socketError})</span>} | 
            Rieles en memoria: {Object.keys(marketDataRegistry).length > 0 ? Object.keys(marketDataRegistry).join(', ') : 'Ninguno'}
          </div>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm text-white transition-all shadow-lg ${isFrankTheme ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/20' : (isRafaTheme || isJarvisTheme) ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'}`}
        >
          <Plus size={18} /> Añadir Radar
        </button>
      </div>

      {radars.length === 0 ? (
        <div className="text-center p-12 border border-dashed border-slate-700 rounded-xl text-slate-500">
          No tienes radares configurados. Haz clic en "Añadir Radar" para empezar.
        </div>
      ) : (
        <div className="space-y-8">
          {radars.map(radar => {
            const normalizePaymentMethod = (pm: string) => {
              const str = String(pm).toLowerCase();
              if (['14', '137', 'banesco'].some(k => str.includes(k))) return 'Banesco';
              if (['316', 'mercantil'].some(k => str.includes(k))) return 'Mercantil';
              if (['64', '130', '318', '377', '382', '416', 'pago', 'movil'].some(k => str.includes(k))) return 'PagoMovil';
              if (['315', 'provincial', 'bbva'].some(k => str.includes(k))) return 'Provincial';
              if (['317', 'venezuela', 'bdv'].some(k => str.includes(k))) return 'BancodeVenezuela';
              if (['321', 'bancamiga'].some(k => str.includes(k))) return 'Bancamiga';
              return 'Banesco';
            };
            
            const keyBank = normalizePaymentMethod(radar.paymentMethod);
            const marketData = marketDataRegistry[radar.id] || {};
            return (
              <RadarCard 
                key={radar.id} 
                config={radar}
                externalMarketData={marketData}
                onUpdate={handleUpdateRadar} 
                onDelete={handleDeleteRadar}
              />
            );
          })}
        </div>
      )}

      {/* Modal Add */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-white mb-6">Nuevo Radar</h2>
            <form onSubmit={handleAddRadar} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
              
              {/* Sección 1: Mercado */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <span className="bg-blue-500/20 text-blue-400 w-5 h-5 flex items-center justify-center rounded">1</span> Mercado y Banco
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Exchange</label>
                    <select 
                      value={newExchange} 
                      onChange={(e) => {
                        const ex = e.target.value as 'binance'|'bybit';
                        setNewExchange(ex);
                        setNewBank(ex === 'binance' ? 'Banesco' : '137');
                      }}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                    >
                      <option value="bybit">Bybit</option>
                      <option value="binance">Binance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Método de Pago</label>
                    <select 
                      value={newBank}
                      onChange={(e) => setNewBank(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                    >
                      {(newExchange === 'binance' ? BINANCE_METHODS : BYBIT_METHODS).map(method => (
                        <option key={method.id} value={method.id}>{method.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección 2: Dinero y Rentabilidad */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-400 w-5 h-5 flex items-center justify-center rounded">2</span> Capital y Rentabilidad
                </h3>
                <p className="text-[11px] text-slate-400 mb-3 leading-tight">Configura el dinero a usar y tu margen de ganancia mínima antes de pausar el anuncio.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Capital (USDT)</label>
                    <input 
                      type="number" 
                      value={newCapitalUsdt}
                      onChange={(e) => setNewCapitalUsdt(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Ganancia Mín. (%)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={newSpreadPct}
                      onChange={(e) => setNewSpreadPct(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Estrategia de Competencia */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <span className="bg-purple-500/20 text-purple-400 w-5 h-5 flex items-center justify-center rounded">3</span> Estrategia del Radar
                </h3>
                <p className="text-[11px] text-slate-400 mb-3 leading-tight">Define cómo competirá el bot contra otros anunciantes.</p>
                <div className="flex flex-col gap-2">
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${newPricingMode === 'agresivo' ? 'bg-purple-500/10 border-purple-500/50' : 'border-transparent hover:bg-slate-800/50'}`}>
                    <input type="radio" name="pricingMode" value="agresivo" checked={newPricingMode === 'agresivo'} onChange={() => setNewPricingMode('agresivo')} className="mt-1 text-purple-500 bg-slate-900 border-slate-600 focus:ring-purple-500" />
                    <div>
                      <div className="text-sm font-bold text-slate-200">🚀 Agresivo / Dominante</div>
                      <div className="text-xs text-slate-400 mt-0.5">Mejora el precio (0.1 VES) para quedar siempre de primero.</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${newPricingMode === 'neutro' ? 'bg-purple-500/10 border-purple-500/50' : 'border-transparent hover:bg-slate-800/50'}`}>
                    <input type="radio" name="pricingMode" value="neutro" checked={newPricingMode === 'neutro'} onChange={() => setNewPricingMode('neutro')} className="mt-1 text-purple-500 bg-slate-900 border-slate-600 focus:ring-purple-500" />
                    <div>
                      <div className="text-sm font-bold text-slate-200">🛡️ Conservador / Neutro</div>
                      <div className="text-xs text-slate-400 mt-0.5">Solo iguala el precio del competidor sin regalar margen.</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sección 4: Límites de Transacción */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <span className="bg-amber-500/20 text-amber-400 w-5 h-5 flex items-center justify-center rounded">4</span> Manejo de Límites
                </h3>
                <p className="text-[11px] text-slate-400 mb-3 leading-tight">¿El bot debe respetar los límites del anuncio original o forzar unos propios?</p>
                <div className="flex flex-col gap-2 mb-3">
                  <label className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${limitType === 'predefined' ? 'bg-amber-500/10 border-amber-500/50' : 'border-transparent hover:bg-slate-800/50'}`}>
                    <input type="radio" name="limitType" value="predefined" checked={limitType === 'predefined'} onChange={() => setLimitType('predefined')} className="text-amber-500 bg-slate-900 border-slate-600 focus:ring-amber-500" />
                    <span className="text-sm font-bold text-slate-200">📊 Auto-Gestionado (Originales)</span>
                  </label>
                  <label className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${limitType === 'custom' ? 'bg-amber-500/10 border-amber-500/50' : 'border-transparent hover:bg-slate-800/50'}`}>
                    <input type="radio" name="limitType" value="custom" checked={limitType === 'custom'} onChange={() => setLimitType('custom')} className="text-amber-500 bg-slate-900 border-slate-600 focus:ring-amber-500" />
                    <span className="text-sm font-bold text-slate-200">⚙️ Forzar Límites Propios</span>
                  </label>
                </div>
                {limitType === 'custom' && (
                  <div className="grid grid-cols-3 gap-2 bg-black/20 p-3 rounded-lg border border-slate-700/50">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Límite 1</label>
                      <input type="number" value={customLimit1} onChange={e => setCustomLimit1(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Límite 2</label>
                      <input type="number" value={customLimit2} onChange={e => setCustomLimit2(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Límite 3</label>
                      <input type="number" value={customLimit3} onChange={e => setCustomLimit3(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono text-xs" />
                    </div>
                  </div>
                )}
              </div>

              {/* Sección 5: Conexión */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                  <span className="bg-rose-500/20 text-rose-400 w-5 h-5 flex items-center justify-center rounded">5</span> Conexión de Anuncios
                </h3>
                <p className="text-[11px] text-slate-400 mb-3 leading-tight">Pega aquí el código numérico de tus anuncios creados en el Exchange.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">ID Anuncio Venta</label>
                    <input 
                      type="text" 
                      value={newSellAdId}
                      onChange={(e) => setNewSellAdId(e.target.value)}
                      placeholder="Ej. 1729301928"
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-sm placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">ID Anuncio Compra</label>
                    <input 
                      type="text" 
                      value={newBuyAdId}
                      onChange={(e) => setNewBuyAdId(e.target.value)}
                      placeholder="Ej. 1729301929"
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-sm placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 sticky bottom-0 bg-[#0f172a] pb-2 z-10 border-t border-slate-800 mt-4">
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                  <Radar size={18} /> Lanzar Radar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
