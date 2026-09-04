'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Radar, RefreshCw, AlertCircle, Target, CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';
import { isFrankTheme, isRafaTheme } from '../../../../lib/theme';
import { RadarConfig } from '../../../api/config/radar/route';

interface RadarCardProps {
  config: RadarConfig;
  externalMarketData?: any;
  onUpdate: (updated: RadarConfig) => void;
  onDelete: (id: string) => void;
}

export default function RadarCard({ config, externalMarketData, onUpdate, onDelete }: RadarCardProps) {
  const [capitalUsdt, setCapitalUsdt] = useState(config.capitalUsdt || 1000);
  const [vitalSpreadPct, setVitalSpreadPct] = useState(config.vitalSpreadPct || 1.5);
  const [sellActive, setSellActive] = useState(config.sellActive);
  const [buyActive, setBuyActive] = useState(config.buyActive);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Recalcular las estrategias basándonos en externalMarketData y capitalUsdt
  const marketData = useMemo(() => {
    if (!externalMarketData || !externalMarketData.top_strategies) {
      return {
        spread_gross_pct: 0,
        spread: 0,
        top_strategies: []
      };
    }

    const sellPrice = externalMarketData.sell_tier_ves || 0;
    const buyPrice = externalMarketData.buy_tier_ves || 0;
    const spreadNet = externalMarketData.spread_gross_pct || 0;
    
    return {
      ...externalMarketData,
      spread: spreadNet,
      top_strategies: externalMarketData.top_strategies
    };
  }, [externalMarketData, capitalUsdt, vitalSpreadPct]);

  const handleUpdateConfig = async () => {
    setIsUpdating(true);
    await onUpdate({
      ...config,
      capitalUsdt,
      vitalSpreadPct,
      sellActive,
      buyActive
    });
    setIsUpdating(false);
  };

  const toggleSell = async () => {
    const newState = !sellActive;
    setSellActive(newState);
    await onUpdate({ ...config, sellActive: newState, buyActive, capitalUsdt, vitalSpreadPct });
  };

  const toggleBuy = async () => {
    const newState = !buyActive;
    setBuyActive(newState);
    await onUpdate({ ...config, sellActive, buyActive: newState, capitalUsdt, vitalSpreadPct });
  };

  const getMethodName = (id: string, exchange: string) => {
    if (exchange === 'bybit') {
      const bybitMap: Record<string, string> = {
        '14': 'Banesco', '137': 'Banesco', '316': 'Mercantil', '318': 'PagoMovil', '130': 'PagoMovil', '315': 'BBVA Provincial', '317': 'Banco de Venezuela', 'Bancamiga': 'Bancamiga', '321': 'Bancamiga'
      };
      return bybitMap[id] || id;
    } else {
      const binanceMap: Record<string, string> = {
        'Banesco': 'Banesco', 'Mercantil': 'Mercantil', 'PagoMovil': 'PagoMovil', 'Provincial': 'BBVA Provincial', 'BancodeVenezuela': 'Banco de Venezuela', 'Bancamiga': 'Bancamiga'
      };
      return binanceMap[id] || id;
    }
  };

  const displayMethod = getMethodName(config.paymentMethod, config.exchange);

  const [activeStrategy, setActiveStrategy] = useState<any>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [botLogs, setBotLogs] = useState<string[]>([]);

  useEffect(() => {
    const fetchActiveStrategy = async () => {
      try {
        const res = await fetch(`/api/p2p/active-strategy?radarId=${config.id}&bank=${displayMethod}`);
        if (res.ok) {
           const data = await res.json();
           setActiveStrategy(data);
        }
      } catch(e) {}
    };
    fetchActiveStrategy();
  }, [displayMethod]);

  // AUTO-TRADER BOT LOOP
  const lastPricesRef = useRef<{buy?: string, sell?: string}>({});
  const lastUpdateRef = useRef<{buy: number, sell: number}>({ buy: 0, sell: 0 });

  useEffect(() => {
    if (activeStrategy && marketData.top_strategies && marketData.top_strategies.length > 0) {
      const currentStrat = marketData.top_strategies.find((s: any) => s.buy_tier_ves === activeStrategy.buy_tier_ves) || marketData.top_strategies[0];
      
      if (currentStrat && (config.buyAdId || config.sellAdId)) {
        const updatePrices = async () => {
          let logMsg = `[${new Date().toLocaleTimeString()}] `;
          let attemptMade = false;

          const targetBuyPrice = buyActive ? Number(currentStrat.our_buy_price) : 500;
          const targetSellPrice = sellActive ? Number(currentStrat.our_sell_price) : 900;
          
          const newBuyStr = String(targetBuyPrice);
          const newSellStr = String(targetSellPrice);

          const now = Date.now();

          if (config.buyAdId && currentStrat.our_buy_price && buyActive && lastPricesRef.current.buy !== newBuyStr) {
            // Protección Anti-Ban: Bybit permite max 10 updates en 5 min (1 cada 30 seg aprox). Usamos 35s.
            if (now - lastUpdateRef.current.buy > 35000) {
              attemptMade = true;
            try {
              const targetBuyPrice = Number(currentStrat.our_buy_price);
              const fixedBuyAmount = 2000; // Siempre compra 2000 USDT
              const maxFiat = fixedBuyAmount * targetBuyPrice;
              const minFiat = currentStrat.buy_tier_ves || 100;
              const paymentId = config.paymentMethod;
              
              const payload = {
                 itemId: config.buyAdId, 
                 price: targetBuyPrice.toFixed(3),
                 amount: Number(fixedBuyAmount).toFixed(4),
                 minAmount: Number(minFiat).toFixed(2),
                 maxAmount: Number(maxFiat).toFixed(2),
                 paymentId: paymentId
              };
              
              const endpoint = config.exchange === 'binance' ? '/api/binance/bot/update-price' : '/api/bybit/bot/update-price';
              const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const data = await res.json();
              lastUpdateRef.current.buy = now; // Hard cooldown aplicado SIEMPRE
              if (data.ok) {
                 logMsg += `COMPRA: ✅ ${newBuyStr} `;
                 lastPricesRef.current.buy = newBuyStr;
              } else {
                 logMsg += `COMPRA: ❌ ${data.error || 'Error'} `;
              }
            } catch(e) { 
               logMsg += `COMPRA: ❌ Red `; 
               lastUpdateRef.current.buy = now; // Hard cooldown aplicado incluso en fallo de red
            }
            } else {
               // logMsg += `COMPRA: ⏳ Rate Limit (Esperando 35s) `;
            }
          }

          if (config.sellAdId && currentStrat.our_sell_price && sellActive && lastPricesRef.current.sell !== newSellStr) {
            if (now - lastUpdateRef.current.sell > 35000) {
              attemptMade = true;
            try {
              const targetSellPrice = Number(currentStrat.our_sell_price);
              const maxFiat = capitalUsdt * targetSellPrice;
              const minFiat = 100000; // Siempre vende con minimo de 100.000 Bs
              const paymentId = config.paymentMethod;
              
              const payload = {
                 itemId: config.sellAdId, 
                 price: targetSellPrice.toFixed(3),
                 amount: Number(capitalUsdt).toFixed(4),
                 minAmount: Number(minFiat).toFixed(2),
                 maxAmount: Number(maxFiat).toFixed(2),
                 paymentId: paymentId
              };

              const endpoint = config.exchange === 'binance' ? '/api/binance/bot/update-price' : '/api/bybit/bot/update-price';
              const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const data = await res.json();
              lastUpdateRef.current.sell = now; // Hard cooldown aplicado SIEMPRE
              if (data.ok) {
                 logMsg += `| VENTA: ✅ ${newSellStr}`;
                 lastPricesRef.current.sell = newSellStr;
              } else {
                 logMsg += `| VENTA: ❌ ${data.error || 'Error'}`;
              }
            } catch(e) { 
               logMsg += `| VENTA: ❌ Red`; 
               lastUpdateRef.current.sell = now; // Hard cooldown aplicado incluso en fallo de red
            }
            } else {
               // logMsg += `| VENTA: ⏳ Rate Limit `;
            }
          }

          if (attemptMade) {
            setBotLogs(prev => [logMsg, ...prev].slice(0, 5));
          }
        };
        
        updatePrices();
      }
    }
  }, [marketData, activeStrategy, config.buyAdId, config.sellAdId, buyActive, sellActive, capitalUsdt]);

  const handleActivateStrategy = async (strat: any) => {
     setIsActivating(true);
     try {
        const res = await fetch(`/api/p2p/active-strategy`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ ...strat, bank: displayMethod, radarId: config.id })
        });
        if (res.ok) {
           setActiveStrategy(strat);
           setIsMinimized(true);
           alert(`🚀 Estrategia Fijada para ${displayMethod}! ByBit ahora auto-actualizará tus anuncios para mantener esta posición.`);
        } else {
           alert('❌ Error activando la estrategia.');
        }
     } catch (e) {
        console.error(e);
        alert('❌ Error conectando con el backend para fijar la estrategia.');
     } finally {
        setIsActivating(false);
     }
  };


  // UI Theme classes
  const isMercantil = displayMethod === 'Mercantil';
  const isPagoMovil = displayMethod === 'Pago Movil';
  const borderColor = isMercantil ? 'border-blue-900/50' : isPagoMovil ? 'border-purple-900/50' : 'border-emerald-900/50';
  const iconColor = isMercantil ? 'text-blue-500' : isPagoMovil ? 'text-purple-500' : 'text-emerald-500';

  return (
    <div className={`mb-10`}>
      {/* Radar Inteligente Top Section */}
      <div className={isFrankTheme ? 'glow-card bg-[#020617] rounded-xl p-6 shadow-xl relative overflow-hidden group' : isRafaTheme ? 'glow-card-rafa bg-[#022c22] rounded-xl p-6 shadow-xl relative overflow-hidden group' : `bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden group ${borderColor}`}>
        {isFrankTheme && <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-orange-500/40 via-transparent to-amber-500/40"></div>}
        {isRafaTheme && <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-emerald-500/40 via-transparent to-teal-500/40"></div>}
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
           <Radar className={`w-32 h-32 animate-[spin_4s_linear_infinite] ${iconColor}`} />
        </div>
        <div className="flex justify-between items-center mb-4 relative z-10">
          <h2 className={isFrankTheme || isRafaTheme ? 'text-xl font-black text-white flex items-center gap-2 font-mono cursor-pointer' : 'text-xl font-bold text-white flex items-center gap-2 cursor-pointer'} onClick={() => setIsMinimized(!isMinimized)}>
            <Radar className={`w-5 h-5 ${iconColor}`} /> 
            {config.exchange === 'binance' ? 'Binance' : 'Bybit'} P2P Radar Inteligente - {displayMethod}
          </h2>
          <div className="flex items-center gap-3">
             <button onClick={() => setIsMinimized(!isMinimized)} className="text-slate-400 hover:text-white transition-colors bg-slate-800/50 p-1.5 rounded-md border border-slate-700">
               {isMinimized ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
             </button>
             <button onClick={() => onDelete(config.id)} className="text-red-400 hover:text-red-300 text-xs font-bold border border-red-500/30 px-3 py-1.5 rounded bg-red-500/10 transition-colors">
               Eliminar
             </button>
          </div>
        </div>
        
        {!isMinimized && (
          <>
            <div className={`flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 relative z-10 p-5 rounded-xl border gap-4 shadow-inner ${isFrankTheme ? 'bg-[#0a0a0a]/60 border-orange-500/20' : isRafaTheme ? 'bg-[#064e3b]/40 border-emerald-500/20' : 'bg-slate-950/40 border-slate-800'}`}>
           <div className="flex flex-col gap-1 w-full lg:w-auto">
              <h3 className="text-sm font-bold text-slate-200">Variables Heurísticas del Sistema</h3>
              <p className="text-xs text-slate-500 max-w-md">El Scanner usa el volumen USDT para fraccionar sus órdenes (limits). El Spread Mínimo Vital funciona como riel protector anti-spoofing.</p>
           </div>
           
           <div className="flex flex-wrap items-center gap-3 mt-2 lg:mt-0 w-full lg:w-auto lg:justify-end">
              <div className="relative group">
                 <div className="absolute -top-7 left-0 text-[10px] text-emerald-400 font-bold uppercase tracking-widest hidden group-hover:block whitespace-nowrap bg-emerald-950/90 border border-emerald-900 px-2 rounded-md py-1">Caja Fiduciaria Operativa</div>
                 <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">$</span>
                 <input 
                    type="number" 
                    value={capitalUsdt}
                    onChange={(e) => setCapitalUsdt(Number(e.target.value))}
                    className={`${isFrankTheme ? 'bg-[#0a0a0a] border-orange-500/30' : isRafaTheme ? 'bg-[#022c22] border-emerald-500/30' : 'bg-slate-900 border-slate-700'} border text-white rounded-lg pl-8 pr-4 py-2 w-32 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-sm transition-all`}
                 />
              </div>
              <div className="relative group">
                 <div className="absolute -top-7 left-0 text-[10px] text-emerald-400 font-bold uppercase tracking-widest hidden group-hover:block whitespace-nowrap bg-emerald-950/90 border border-emerald-900 px-2 rounded-md py-1">Spread Seguro Dinámico</div>
                 <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-400 font-bold">%</span>
                 <input 
                    type="number" 
                    step="0.1"
                    value={vitalSpreadPct}
                    onChange={(e) => setVitalSpreadPct(Number(e.target.value))}
                    className={`${isFrankTheme ? 'bg-[#0a0a0a] border-orange-500/30' : isRafaTheme ? 'bg-[#022c22] border-emerald-500/30' : 'bg-slate-900 border-slate-700'} border text-white rounded-lg pl-8 pr-4 py-2 w-32 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-sm transition-all`}
                 />
              </div>
              <button 
                onClick={handleUpdateConfig}
                disabled={isUpdating}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg font-bold transition-all disabled:opacity-50 text-sm shadow-[0_0_15px_rgba(5,150,105,0.4)] flex items-center gap-2"
              >
                {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Radar className="w-4 h-4"/>}
                {isUpdating ? 'Guardando...' : 'Re-Calibrar Radar'}
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {marketData.top_strategies && marketData.top_strategies.length > 0 ? (
            marketData.top_strategies.slice(0, 3).map((strat: any, idx: number) => {
              return (
               <div 
                 key={idx} 
                 className={`${isFrankTheme ? 'bg-[#0a0a0a]/80' : isRafaTheme ? 'bg-[#064e3b]/40' : 'bg-slate-950/60'} border rounded-xl p-5 shadow-2xl relative overflow-hidden group transition-all duration-300
                   ${idx === 0 ? (isFrankTheme ? 'border-orange-400 ring-1 ring-orange-400/50' : isRafaTheme ? 'border-emerald-400 ring-1 ring-emerald-400/50' : 'border-emerald-400 ring-1 ring-emerald-400/50') : 
                   (isFrankTheme ? 'border-orange-500/20' : isRafaTheme ? 'border-emerald-500/20' : 'border-slate-700/50')}`}
               >
                 {idx === 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full z-0"></div>}
                 
                 <div className="flex justify-between items-center mb-4 relative z-10">
                   <h3 className="text-white font-bold text-lg flex items-center gap-2">
                      {idx === 0 ? '🏆 Óptima' : `Secundaria #${idx+1}`}
                   </h3>
                   <span className={`px-2 py-1 text-xs font-bold rounded-lg ${strat.spread_net_pct >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                     {strat.spread_net_pct.toFixed(2)}% Neto
                   </span>
                 </div>
                 
                 <div className="space-y-3 text-sm relative z-10">
                   <div className={`flex justify-between border-b ${isFrankTheme ? 'border-orange-500/20' : isRafaTheme ? 'border-emerald-500/20' : 'border-slate-800'} pb-2`}>
                     <span className="text-slate-400">Si vendemos min.</span>
                     <span className="text-white font-mono w-24 text-right">{(strat.sell_tier_ves/1000).toFixed(0)}k VES</span>
                   </div>
                   <div className={`flex justify-between border-b ${isFrankTheme ? 'border-orange-500/20' : isRafaTheme ? 'border-emerald-500/20' : 'border-slate-800'} pb-2`}>
                     <span className={isFrankTheme ? 'text-orange-400' : 'text-emerald-400'}>Postura Venta a</span>
                     <span className={`${isFrankTheme ? 'text-orange-400' : 'text-emerald-400'} font-mono font-bold w-24 text-right`}>{strat.our_sell_price.toFixed(2)}</span>
                   </div>
                   
                   <div className={`flex justify-between border-b ${isFrankTheme ? 'border-orange-500/20' : isRafaTheme ? 'border-emerald-500/20' : 'border-slate-800'} pb-2 pt-2`}>
                     <span className="text-slate-400">Y compramos min.</span>
                     <span className="text-white font-mono w-24 text-right">{(strat.buy_tier_ves/1000).toFixed(0)}k VES</span>
                   </div>
                   <div className={`flex justify-between border-b ${isFrankTheme ? 'border-orange-500/20' : isRafaTheme ? 'border-emerald-500/20' : 'border-slate-800'} pb-2`}>
                     <span className="text-rose-400">Postura Compra a</span>
                     <span className="text-rose-400 font-mono font-bold w-24 text-right">{strat.our_buy_price.toFixed(2)}</span>
                   </div>
                 </div>

                 <div className="mt-5 pt-3 border-t border-slate-700/30 flex justify-center relative z-10">
                   <button 
                      onClick={() => handleActivateStrategy(strat)}
                      disabled={isActivating}
                      className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                        activeStrategy?.buy_tier_ves === strat.buy_tier_ves 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 cursor-default shadow-[0_0_15px_rgba(52,211,153,0.2)]' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-500'
                      }`}
                   >
                      {activeStrategy?.buy_tier_ves === strat.buy_tier_ves ? (
                        <> <CheckCircle2 className="w-5 h-5"/> Operando </>
                      ) : (
                        <> <Target className="w-5 h-5"/> Seleccionar </>
                      )}
                   </button>
                 </div>
               </div>
              );
            })
          ) : (
            !externalMarketData.top_strategies ? (
              externalMarketData.has_error ? (
                <div className="col-span-3 p-12 flex flex-col items-center justify-center text-red-400 bg-red-900/10 rounded-xl border border-red-800/30 mt-4">
                  <AlertCircle className="w-8 h-8 mb-4 opacity-80" />
                  <h3 className="font-bold mb-2">Error Sincronizando:</h3>
                  <p className="text-sm text-center max-w-md font-mono">{externalMarketData.error_msg || "Fallo en la comunicación con la API."}</p>
                </div>
              ) : (
                <div className="col-span-3 p-12 flex flex-col items-center justify-center text-slate-500 bg-slate-900/20 rounded-xl border border-slate-800/50 mt-4">
                  <Radar className="w-8 h-8 mb-4 animate-[spin_3s_linear_infinite] opacity-50" />
                  <h3 className="font-bold text-white mb-2">Sincronizando con el Exchange...</h3>
                  <p className="text-sm text-center max-w-md">Esperando el próximo bloque del Orderbook para analizar las heurísticas.</p>
                </div>
              )
            ) : null
          )}
        </div>

        {/* LOGS DEL AUTO-TRADER */}
        {activeStrategy && (config.buyAdId || config.sellAdId) && (
          <div className="mt-6 p-4 rounded-lg bg-black/40 border border-slate-800/50 relative z-10">
            <h3 className="text-xs font-bold text-slate-400 mb-2 font-mono uppercase tracking-widest flex items-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" /> AutoTrader Bot Logs
            </h3>
            <div className="space-y-1">
              {botLogs.length === 0 ? (
                 <p className="text-xs text-slate-500 font-mono">Esperando el próximo escaneo del mercado (15s)...</p>
              ) : (
                botLogs.map((log, i) => (
                  <p key={i} className={`text-xs font-mono ${i === 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    {log}
                  </p>
                ))
              )}
            </div>
          </div>
        )}

        <div className={`mt-4 pt-4 border-t flex justify-between items-center relative z-10 rounded-lg p-3 ${isFrankTheme ? 'border-orange-500/20 bg-[#0a0a0a]/80' : isRafaTheme ? 'border-emerald-500/20 bg-[#022c22]/80' : 'border-slate-800 bg-slate-900/80'}`}>
          <span className="text-slate-400">Spread Bruto: <span className="text-white font-mono ml-2 tracking-wide">{marketData.spread_gross_pct?.toFixed(2)}%</span></span>
          <span className="text-slate-400">Yield de Arbitraje Neto (Maker): <span className={`font-bold font-mono ml-2 text-lg ${marketData.spread >= 0 ? 'text-emerald-400 dropshadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'text-rose-400'}`}>{marketData.spread?.toFixed(2)}%</span></span>
        </div>
          </>
        )}
      </div>

      {/* Sentinel: Estrategia Operativa */}
      <div className={isFrankTheme ? "bg-[#0a0a0a] border border-orange-500/10 rounded-xl p-4 sm:p-6 shadow-2xl relative overflow-hidden mt-6 group" : isRafaTheme ? "bg-[#022c22] border border-emerald-500/10 rounded-xl p-4 sm:p-6 shadow-2xl relative overflow-hidden mt-6 group" : "bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 sm:p-6 shadow-2xl relative overflow-hidden mt-6 group"}>
          <div className={`absolute top-0 left-0 w-full h-1 blur-sm opacity-50 z-0 ${isFrankTheme ? 'bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500' : isRafaTheme ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-500' : 'bg-gradient-to-r from-indigo-500 via-emerald-400 to-indigo-500'}`}></div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center relative z-10 mb-4 gap-4 sm:gap-0">
             <div>
               <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span className="relative flex h-3 w-3 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  Sentinel: Estrategia Operativa
               </h2>
               <p className="text-xs sm:text-sm text-slate-400 mt-1">El Bot de {config.exchange === 'binance' ? 'Binance' : 'Bybit'} está empujando asincrónicamente estos targets fiduciarios a la red matriz.</p>
             </div>
             
             <div className={isFrankTheme ? "px-4 py-2 bg-orange-900/10 rounded-lg border border-orange-500/20 w-full sm:w-auto" : isRafaTheme ? "px-4 py-2 bg-emerald-900/10 rounded-lg border border-emerald-500/20 w-full sm:w-auto" : "px-4 py-2 bg-indigo-900/50 rounded-lg border border-indigo-500/30 w-full sm:w-auto"}>
                <span className={isFrankTheme ? "text-orange-400 text-xs font-bold uppercase tracking-wider block mb-1" : isRafaTheme ? "text-emerald-400 text-xs font-bold uppercase tracking-wider block mb-1" : "text-indigo-400 text-xs font-bold uppercase tracking-wider block mb-1"}>Estrategia Asignada</span>
                <span className="text-white font-mono text-sm">Capital: ${capitalUsdt} <span className="text-slate-500 mx-1">|</span> Spread: {vitalSpreadPct}%</span>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* Tarjeta Venta */}
            <div className={`p-5 rounded-xl border ${sellActive ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-900/50 border-slate-700/50 opacity-80'}`}>
              <div className="flex justify-between items-center mb-2">
                 <h3 className={`font-bold ${sellActive ? 'text-emerald-400' : 'text-slate-400'}`}>Anuncio Venta (VENDEMOS USDT)</h3>
                 <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${sellActive ? 'text-emerald-400' : 'text-slate-500'}`}>{sellActive ? 'LIVE' : 'OFFLINE'}</span>
                    <button 
                      onClick={toggleSell}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${sellActive ? 'bg-emerald-500' : 'bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sellActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                 </div>
              </div>
              <p className="text-xs text-slate-500 mb-4 flex items-center gap-2">
                 <span>{config.exchange === 'binance' ? 'Binance' : 'Bybit'} Maker AD ID Auto-Pilot</span>
                 {config.sellAdId && <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono text-[10px] border border-slate-700">ID: {config.sellAdId}</span>}
              </p>
              
              <div className="flex justify-between items-end">
                <div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${sellActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>Top #1 Competing</span>
                </div>
                <div className="text-right">
                  {sellActive ? (
                    <div className="text-3xl font-mono font-bold text-white flex items-baseline gap-1 justify-end">
                       {marketData.top_strategies?.find((s: any) => s.strategy_id === activeStrategy?.strategy_id)?.our_sell_price?.toFixed(2) || activeStrategy?.our_sell_price?.toFixed(2) || marketData.top_strategies?.[0]?.our_sell_price?.toFixed(2) || '---'} <span className="text-sm text-slate-400">VES</span>
                    </div>
                  ) : (
                    <div className="text-3xl font-mono font-bold text-rose-500 flex items-baseline gap-1 justify-end line-through opacity-70">
                       {(config.exchange === 'binance' ? 800 : 900).toFixed(2)} <span className="text-sm text-slate-500">VES</span>
                    </div>
                  )}
                  {!sellActive && <div className="text-xs text-rose-400 mt-1">Precio extremo (Nadie compra tan caro)</div>}
                </div>
              </div>
            </div>

            {/* Tarjeta Compra */}
            <div className={`p-5 rounded-xl border ${buyActive ? 'bg-rose-950/20 border-rose-500/30' : 'bg-slate-900/50 border-slate-700/50 opacity-80'}`}>
              <div className="flex justify-between items-center mb-2">
                 <h3 className={`font-bold ${buyActive ? 'text-rose-400' : 'text-slate-400'}`}>Anuncio Compra (COMPRAMOS USDT)</h3>
                 <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${buyActive ? 'text-rose-400' : 'text-slate-500'}`}>{buyActive ? 'LIVE' : 'OFFLINE'}</span>
                    <button 
                      onClick={toggleBuy}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${buyActive ? 'bg-rose-500' : 'bg-slate-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${buyActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                 </div>
              </div>
              <p className="text-xs text-slate-500 mb-4 flex items-center gap-2">
                 <span>{config.exchange === 'binance' ? 'Binance' : 'Bybit'} Maker AD ID Auto-Pilot</span>
                 {config.buyAdId && <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono text-[10px] border border-slate-700">ID: {config.buyAdId}</span>}
              </p>
              
              <div className="flex justify-between items-end">
                <div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${buyActive ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>Top #1 Competing</span>
                </div>
                <div className="text-right">
                  {buyActive ? (
                    <div className="text-3xl font-mono font-bold text-white flex items-baseline gap-1 justify-end">
                       {marketData.top_strategies?.find((s: any) => s.strategy_id === activeStrategy?.strategy_id)?.our_buy_price?.toFixed(2) || activeStrategy?.our_buy_price?.toFixed(2) || marketData.top_strategies?.[0]?.our_buy_price?.toFixed(2) || '---'} <span className="text-sm text-slate-400">VES</span>
                    </div>
                  ) : (
                    <div className="text-3xl font-mono font-bold text-sky-500 flex items-baseline gap-1 justify-end line-through opacity-70">
                       {(config.exchange === 'binance' ? 650 : 500).toFixed(2)} <span className="text-sm text-slate-500">VES</span>
                    </div>
                  )}
                  {!buyActive && <div className="text-xs text-sky-400 mt-1">Precio extremo (Nadie vende tan bajo)</div>}
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
