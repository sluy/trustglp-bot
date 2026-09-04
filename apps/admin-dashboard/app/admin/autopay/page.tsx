'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Play, Square, AlertCircle, CheckCircle2, Server, Key, Eye } from 'lucide-react';
import { IS_DEMO } from '../../../lib/demoMode';
import { demoAutopayAccounts, demoAutopayOrders } from '../../../lib/demoData';
import { isJarvisTheme } from '../../../lib/theme';

export default function AutoPayDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{username: string, enabled: boolean, min: number, max: number}[]>([]);

  // Fetch accounts
  const fetchAccounts = async () => {
    if (IS_DEMO) {
      setAccounts(demoAutopayAccounts);
      return;
    }
    try {
      const res = await fetch('/api/autopay/accounts');
      const data = await res.json();
      if (data.ok) {
        setAccounts(data.accounts || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateAccountConfig = async (username: string, updates: Partial<{enabled: boolean, min: number, max: number}>) => {
    const account = accounts.find(a => a.username === username);
    if (!account) return;
    
    const newConfig = { ...account, ...updates };
    
    // Optimistic update
    setAccounts(prev => prev.map(a => a.username === username ? newConfig : a));
    try {
      await fetch('/api/autopay/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      // We don't fetch immediately to avoid input focus jumping, 
      // the background interval will sync it eventually.
    } catch (e) {
      console.error(e);
      fetchAccounts();
    }
  };

  // Fetch engine status
  const checkEngineStatus = async () => {
    if (IS_DEMO) {
      setIsRunning(true);
      return;
    }
    try {
      const res = await fetch('/api/autopay/engine');
      const data = await res.json();
      setIsRunning(data.isRunning || false);
      if (data.last_error) setLastError(data.last_error);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch assigned orders
  const fetchAssignedOrders = async () => {
    if (IS_DEMO) {
      setAssignedOrders(demoAutopayOrders);
      return;
    }
    try {
      const [binRes, bybRes, assignRes] = await Promise.all([
        fetch('/api/binance/orders').catch(() => ({ json: () => ({ orders: [] }) })),
        fetch('/api/bybit/orders').catch(() => ({ json: () => ({ orders: [] }) })),
        fetch('/api/orders/assignments').catch(() => ({ json: () => ({}) }))
      ]);
      const binData = await binRes.json();
      const bybData = await bybRes.json();
      const assignments = await assignRes.json();

      const allOrders = [...(binData.orders || []), ...(bybData.orders || [])];

      // Mostrar cualquier orden asignada al BOT, sin importar su estado actual
      const botOrders = allOrders.filter((o: any) => {
        const oId = (o.bybitOrderId || o.binanceOrderId) || o.id;
        return assignments[oId]?.operatorId === 'BOT';
      });
      setAssignedOrders(botOrders);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleEngine = async () => {
    if (IS_DEMO) {
      setIsRunning(prev => !prev);
      return;
    }
    const action = isRunning ? 'stop' : 'start';
    // Optimistic UI update
    setIsRunning(!isRunning);
    try {
      await fetch('/api/autopay/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      await checkEngineStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestRpa = async () => {
    const defaultMonto = "1000.00";
    const userMonto = window.prompt("Esto iniciará una transferencia real (CI: 21130158, Cuenta: 01340330993301045172).\n\nIngresa el monto a transferir en Bs (usa punto para decimales):", defaultMonto);
    
    if (!userMonto) return; // User cancelled
    
    const parsedMonto = parseFloat(userMonto);
    if (isNaN(parsedMonto) || parsedMonto <= 0) {
      alert("Monto inválido");
      return;
    }

    try {
      const res = await fetch('/api/autopay/test-rpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedula: "21130158",
          cuenta: "01340330993301045172",
          monto: parsedMonto
        })
      });
      const data = await res.json();
      if (data.ok) alert("🚀 " + data.message + "\n\nRevisa Telegram o los logs para ver el progreso del bot de Banesco.");
      else alert("❌ Error: " + data.error);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleTestPagoMovil = async () => {
    try {
      const res = await fetch('/api/autopay/test-pago-movil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banco: "BANCO MERCANTIL C.A.",
          beneficiario: "Daniela De Freitas",
          cedula: "V21130158",
          telefono: "04242407231",
          monto: 600.00
        })
      });
      const data = await res.json();
      if (data.ok) alert("🚀 " + data.message + "\n\nRevisa Telegram o los logs para ver el progreso del bot de Banesco.");
      else alert("❌ Error: " + data.error);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleTestPagoMovilBanesco = async () => {
    try {
      const res = await fetch('/api/autopay/test-pago-movil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banco: "BANESCO",
          beneficiario: "Daniela De Freitas",
          cedula: "V21130158",
          telefono: "04242407231",
          monto: 100.00
        })
      });
      const data = await res.json();
      if (data.ok) alert("🚀 " + data.message + "\n\nRevisa Telegram o los logs para ver el progreso del bot de Banesco.");
      else alert("❌ Error: " + data.error);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleTestMultipleRpa = async () => {
    const defaultMonto = "50.00";
    const userMonto = window.prompt("⚠️ Esto iniciará DOS transferencias simultáneas a (CI: 21130158, Cuenta: 01340330993301045172) usando tus dos primeras cuentas Banesco configuradas.\n\nIngresa el monto a transferir POR CADA UNA en Bs (usa punto para decimales):", defaultMonto);
    
    if (!userMonto) return;
    
    const parsedMonto = parseFloat(userMonto);
    if (isNaN(parsedMonto) || parsedMonto <= 0) {
      alert("Monto inválido");
      return;
    }

    try {
      const res = await fetch('/api/autopay/test-multiple-rpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: parsedMonto })
      });
      const data = await res.json();
      if (data.ok) alert("🚀 " + data.message + "\n\nRevisa Telegram o los logs para ver el progreso múltiple del bot.");
      else alert("❌ Error: " + data.error);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  useEffect(() => {
    checkEngineStatus();
    fetchAssignedOrders();
    fetchAccounts();
    const interval = setInterval(() => {
      checkEngineStatus();
      fetchAssignedOrders();
      fetchAccounts();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Server className="w-8 h-8 text-blue-500" />
            Auto-Pay Bot (Backend Edition)
          </h1>
          <p className="text-slate-400 mt-1">Automatización RPA 100% en el servidor. Monitoreo por Telegram.</p>
        </div>
        <div className="flex gap-4">
          {!IS_DEMO && (
            <button 
              onClick={handleTestRpa}
              className="w-48 font-bold text-md flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all cursor-pointer bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
            >
              🧪 TEST BANESCO
            </button>
          )}
          {false && !IS_DEMO && (<>
          <button 
            onClick={handleTestPagoMovil}
            className="w-48 font-bold text-md flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
          >
            📱 TEST PM OTROS
          </button>
          <button 
            onClick={handleTestPagoMovilBanesco}
            className="w-48 font-bold text-md flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all cursor-pointer bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20"
          >
            📱 TEST PM BANESCO
          </button>
          <button 
            onClick={handleTestMultipleRpa}
            className="w-48 font-bold text-md flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
          >
            ⚡ TEST MÚLTIPLE
          </button>
          </>)}
          <button 
            onClick={toggleEngine} 
            className={`w-48 font-bold text-md flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all cursor-pointer ${isRunning ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'}`}
          >
            {isRunning ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            {isRunning ? 'DETENER MOTOR' : 'INICIAR MOTOR'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: CONFIG & ESTADO */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Key className="w-5 h-5 text-slate-400" />
                Configuración RPA
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-400">
                El motor ahora corre de forma persistente en el servidor Python. Recibirás los comprobantes y logs de errores directamente en tu grupo de Telegram.
              </div>
              <div className={`p-4 rounded-lg border flex items-center gap-3 ${isRunning ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                {isRunning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5" />}
                <span className="font-semibold">{isRunning ? 'Backend Escaneando...' : 'Motor Inactivo'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-400" />
                Controlador de Cuentas Banesco
              </h3>
            </div>
            <div className="p-6 space-y-3">
              {accounts.length === 0 ? (
                <div className="text-sm text-slate-500 text-center">No hay cuentas configuradas. Revisa tu archivo .env.</div>
              ) : (
                accounts.map(acc => (
                  <div key={acc.username} className="flex flex-col p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-slate-200 font-semibold">{acc.username}</span>
                      <button
                        onClick={() => updateAccountConfig(acc.username, { enabled: !acc.enabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${acc.enabled ? 'bg-green-500' : 'bg-slate-700'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${acc.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    {acc.enabled && (
                      <div className="flex items-center gap-4 border-t border-slate-800/50 pt-3">
                        <div className="flex-1">
                          <label className="text-xs text-slate-500 mb-1 block">Min (VES)</label>
                          <input 
                            type="number" 
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-300"
                            value={acc.min}
                            onChange={(e) => updateAccountConfig(acc.username, { min: Number(e.target.value) })}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-slate-500 mb-1 block">Max (VES)</label>
                          <input 
                            type="number" 
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-300"
                            value={acc.max}
                            onChange={(e) => updateAccountConfig(acc.username, { max: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-400" />
                Órdenes Tomadas (BOT)
              </h3>
            </div>
            <div className="p-6">
              {assignedOrders.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  Ninguna orden bajo control del Bot en este momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {assignedOrders.map(o => (
                    <div key={o.id} className="p-3 bg-slate-950 rounded border border-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono text-xs text-blue-400">{o.id}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">{o.exchange}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="text-sm text-slate-300 font-semibold">{!isNaN(Number(o.amountFiat)) ? Number(o.amountFiat).toFixed(2) : o.amountFiat} VES</div>
                        <div className="text-xs text-slate-500">{o.counterparty}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: LOGS DE TELEGRAM */}
        <div className="lg:col-span-2">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-xl h-full flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Server className="w-5 h-5 text-slate-400" />
                Terminal de Operaciones
              </h3>
              <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-semibold">Integrado con Telegram</span>
            </div>
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                <Server className="w-12 h-12 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-200">Motor Migrado Exitosamente</h2>
              <p className="text-slate-400 max-w-md">
                Los procesos ahora se ejecutan de manera aislada en el servidor backend (Python). 
                Ya no es necesario mantener esta pestaña abierta.
              </p>
              {lastError && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl mt-4 max-w-lg">
                  <p className="text-xs font-bold text-red-400 mb-1">Último Error en Backend:</p>
                  <p className="text-sm text-red-300 font-mono break-words">{lastError}</p>
                </div>
              )}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl mt-6">
                <p className="text-sm text-slate-300 font-medium">📱 Por favor revisa tu aplicación de Telegram para ver los logs en tiempo real, recepción de comprobantes y alertas de fondos.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
