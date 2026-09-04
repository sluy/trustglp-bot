'use client';
import { useState, useEffect } from 'react';
import { Wallet, Link2, TrendingUp, CheckCircle, Clock, RefreshCw, Eye, X, Copy } from 'lucide-react';

const P2pCountdown = ({ createdAt, status }: { createdAt: string, status: string }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'PAYMENT_SENT') {
      setTimeLeft('--:--');
      return;
    }
    const targetTime = new Date(createdAt).getTime() + 30 * 60 * 1000;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetTime - now;
      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft('EXPIRADO');
        setIsExpired(true);
      } else {
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt, status]);

  if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'PAYMENT_SENT') return null;

  return (
    <div className={`mt-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border w-fit ${isExpired ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
       <span>⏳ {timeLeft}</span>
    </div>
  );
};

export function P2pMarketplaceView({ profile }: { profile: any }) {
  const [orders, setOrders] = useState([]);
  const [assignedOrders, setAssignedOrders] = useState([]);
  const [fiatFilter, setFiatFilter] = useState('ALL');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [requestingCI, setRequestingCI] = useState(false);
  const [receiptImageBase64, setReceiptImageBase64] = useState<string | null>(null);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  const [p2pBalance, setP2pBalance] = useState(Number(profile?.p2pUsdtBalance) || 0);
  const [completedTransfers, setCompletedTransfers] = useState(0);
  const [activeBankTab, setActiveBankTab] = useState<'General' | 'Banesco' | 'Mercantil' | 'Pago Móvil'>('General');

  useEffect(() => {
    if (profile) {
       setP2pBalance(Number(profile.p2pUsdtBalance) || 0);
    }
  }, [profile]);

  const handleFileChange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event: any) => {
          const dataUrl = event.target.result;
          const img = new Image();
          img.onload = () => {
              try {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 1000;
                  let scaleSize = 1;
                  if (img.width > MAX_WIDTH) scaleSize = MAX_WIDTH / img.width;
                  canvas.width = img.width * scaleSize;
                  canvas.height = img.height * scaleSize;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                      // Rellenar de blanco para evitar que los PNG transparentes se pongan negros en JPG
                      ctx.fillStyle = '#ffffff';
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  }
                  const compressed = canvas.toDataURL('image/jpeg', 0.8);
                  // Si el resultado es muy raro (menor a 20kb para un canvas de 1000px, asume falla de canvas móvil)
                  if (compressed.length < 20000 && img.width > 200) {
                      setReceiptImageBase64(dataUrl);
                  } else {
                      setReceiptImageBase64(compressed);
                  }
              } catch (error) {
                  // Fallback fallback
                  setReceiptImageBase64(dataUrl);
              }
          };
          // Si por alguna razón img.onload no se dispara
          img.onerror = () => {
             setReceiptImageBase64(dataUrl);
          };
          img.src = dataUrl;
      };
      reader.readAsDataURL(file);
  };

  const fetchOrders = async () => {
     const P2P_API = process.env.NEXT_PUBLIC_P2P_API_URL || 'https://agencia-ia-core-p2p-marketplace.jkmm2u.easypanel.host/p2p-command';
     try {
        const res = await fetch(`${P2P_API}/orders/pending`);
        if (res.ok) {
           const data = await res.json();
           setOrders(data);
        }
        if (profile?.id) {
           const resAssigned = await fetch(`${P2P_API}/orders/assigned/${profile.id}`);
           if (resAssigned.ok) {
              const assignedData = await resAssigned.json();
              setAssignedOrders(assignedData);
           }
        }
     } catch(e) {
        console.error("Error fetching Marketplace Sync", e);
     }
  };

  const syncAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/orders/assignments');
      if (res.ok) {
        const data = await res.json();
        setAssignedOrders(data);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchOrders();
    const int1 = setInterval(fetchOrders, 4000);
    const int2 = setInterval(syncAssignments, 1000); // Polling de asignaciones rápido
    return () => {
        clearInterval(int1);
        clearInterval(int2);
    };
  }, [syncAssignments]);

  const handleTakeOrder = async (orderId: string) => {
      const confirmAction = confirm(`¿Deseas tomar la orden ${orderId} y realizar el pago Fiat?`);
      if(confirmAction) {
         try {
            const P2P_API = process.env.NEXT_PUBLIC_P2P_API_URL || 'https://agencia-ia-core-p2p-marketplace.jkmm2u.easypanel.host/p2p-command';
            const res = await fetch(`${P2P_API}/orders/${orderId}/assign`, {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ userId: profile.id })
            });

            if(res.ok) {
               alert(`Orden ${orderId} asignada. Revisa tus pagos pendientes y transfiere.`);
               const takenOrder = orders.find((o:any) => o.bybitOrderId === orderId);
               if (takenOrder) setAssignedOrders((prev) => [...prev, takenOrder] as any);
               setOrders((prev) => prev.filter((o: any) => o.bybitOrderId !== orderId));
            } else {
               alert('Ocurrió un error al asignar la liquidez.');
            }
         } catch(e) {
            alert('Error de conexión con el Marketplace.');
         }
      }
  };

  const handleMarkAsPaid = async (orderId: string) => {
    if (!confirm('¿Has realizado el pago? Esto no se puede deshacer.')) return;
    try {
      const P2P_API = process.env.NEXT_PUBLIC_P2P_API_URL || 'https://agencia-ia-core-p2p-marketplace.jkmm2u.easypanel.host/p2p-command';
      await fetch(`${P2P_API}/orders/${orderId}/payment-sent`, { method: 'POST' });
      alert('Marcado como Pagado.');
      setAssignedOrders(prev => prev.filter((o: any) => o.bybitOrderId !== orderId));
      fetchOrders();
    } catch(e) {
      alert('Error procesando el pago en Bybit.');
    }
  };

  const handleMarkAsPaidWithReceipt = async (orderId: string) => {
     if (!receiptImageBase64) return alert("Sube el comprobante primero.");
     setIsSendingReceipt(true);
     try {
         const P2P_API = process.env.NEXT_PUBLIC_P2P_API_URL || 'https://agencia-ia-core-p2p-marketplace.jkmm2u.easypanel.host/p2p-command';
         const res = await fetch(`${P2P_API}/orders/${orderId}/pay-with-receipt`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ imageBase64: receiptImageBase64 })
         });
         
         if (res.ok) {
             alert('Comprobante subido al chat y orden marcada como PAGADA exitosamente.');
             
             // Update wallet and success count
             if (selectedOrderDetails?.amountUsdt) {
                setP2pBalance(prev => prev + Number(selectedOrderDetails.amountUsdt));
             }
             setCompletedTransfers(prev => prev + 1);

             setReceiptImageBase64(null);
             setSelectedOrderDetails(null);
             setAssignedOrders(prev => prev.filter((o: any) => o.bybitOrderId !== orderId));
             fetchOrders();
         } else {
             const errData = await res.json().catch(() => null);
             const serverMsg = errData?.message || errData?.error || 'Error desconocido del Gateway';
             alert(`Hubo un error contactando a la API de Bybit:\n\n${serverMsg}`);
         }
     } catch (e) {
         console.error(e);
         alert('Error subiendo comprobante.');
     } finally {
         setIsSendingReceipt(false);
     }
  };

  const handleViewPaymentDetails = async (orderId: string) => {
      setLoadingDetails(true);
      setSelectedOrderDetails({ orderId });
      try {
          const P2P_API = process.env.NEXT_PUBLIC_P2P_API_URL || 'https://agencia-ia-core-p2p-marketplace.jkmm2u.easypanel.host/p2p-command';
          const res = await fetch(`${P2P_API}/orders/${orderId}/counterparty`);
          if (res.ok) {
             const result = await res.json();
             setSelectedOrderDetails({ orderId, ...result });
          } else {
             alert('Error al obtener contraparte.');
             setSelectedOrderDetails(null);
          }
      } catch(e) {
          console.error(e);
          setSelectedOrderDetails(null);
      } finally {
          setLoadingDetails(false);
      }
  };

  const handleRequestCI = async (orderId: string) => {
      setRequestingCI(true);
      try {
         const P2P_API = process.env.NEXT_PUBLIC_P2P_API_URL || 'https://agencia-ia-core-p2p-marketplace.jkmm2u.easypanel.host/p2p-command';
         const res = await fetch(`${P2P_API}/orders/${orderId}/chat`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: "¡Hola! Por medidas de seguridad y para poder emitir la transferencia a tu nombre, requerimos tu número de Cédula y tu Número de Cuenta bancaria de 20 dígitos. Por favor escríbelos por aquí para enviar el dinero inmediatamente. Gracias." })
         });
         if(res.ok) {
             alert('Se ha enviado el mensaje solicitando los Datos al chat de Bybit. Actualiza o vuelve a clickear "Ver Pago" en unos segundos para que el sistema detecte la respuesta automáticamente.');
         } else {
             alert('Hubo un error enviando el mensaje por chat.');
         }
      } catch (e) {
         alert('Error conectando a la API de Chat Bybit.');
      } finally {
         setRequestingCI(false);
      }
  };

  const filterOrderFn = (o: any) => {
      if (fiatFilter !== 'ALL') {
         const orderCurrency = o.currencyId || o.currency || 'VES';
         if (orderCurrency !== fiatFilter) return false;
      }
      if (activeBankTab === 'General') return true;
      const retailNameNorm = (o.retailName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isMercantil = ['316', '321'].some(id => o.bankDetails?.includes(id)) || o.bankDetails?.includes('mercantil') || retailNameNorm.includes('mercantil');
      const isPagoMovil = ['64', '318', '377', '382', '416'].some(id => o.bankDetails?.includes(id)) || o.bankDetails?.includes('pagomovil') || retailNameNorm.includes('pago movil') || retailNameNorm.includes('pagomovil');
      
      if (activeBankTab === 'Mercantil') return isMercantil;
      if (activeBankTab === 'Pago Móvil') return isPagoMovil;
      return !isMercantil && !isPagoMovil; // Banesco
      return !isMercantil && !isPagoMovil; // Banesco
  };

  const filteredOrders = orders.filter(filterOrderFn);
  const filteredAssignedOrders = assignedOrders.filter(filterOrderFn);

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500 w-full">
      <header className="border-b border-white/10 pb-6 mt-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
           <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400 tracking-tight flex items-center gap-3">
             Marketplace de Liquidez OTC
           </h2>
           <p className="text-slate-400 mt-2 text-sm max-w-2xl">
             Toma las órdenes P2P entrantes de la Agencia, transfiere el equivalente Fiat al vendedor y gana <strong>USDT garantizado</strong> en tu bóveda virtual por proveer servicio de cajero.
           </p>
        </div>
        
        <div className="flex bg-slate-900/50 p-1 w-fit rounded-lg border border-slate-800 backdrop-blur-md relative z-20">
           <button 
             className={`px-6 py-2 rounded-md font-bold transition-all ${activeBankTab === 'General' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
             onClick={() => setActiveBankTab('General')}
           >
             🌎 General
           </button>
           <button 
             className={`px-6 py-2 rounded-md font-bold transition-all ${activeBankTab === 'Banesco' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
             onClick={() => setActiveBankTab('Banesco')}
           >
             🏦 Banesco
           </button>
           <button 
             className={`px-6 py-2 rounded-md font-bold transition-all ${activeBankTab === 'Mercantil' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
             onClick={() => setActiveBankTab('Mercantil')}
           >
             🏦 Mercantil
           </button>
           <button 
             className={`px-6 py-2 rounded-md font-bold transition-all ${activeBankTab === 'Pago Móvil' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
             onClick={() => setActiveBankTab('Pago Móvil')}
           >
             📱 Pago Móvil
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-6 shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-center relative z-10">
              <div className="flex items-center gap-3 text-slate-300">
                <Wallet className="w-6 h-6 text-emerald-400" /> 
                <span className="font-semibold text-lg">Mi Billetera Virtual P2P</span>
              </div>
          </div>
          <div className="mt-4 relative z-10">
              <p className="text-4xl font-black text-white">
                 $ {p2pBalance.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-xl font-normal text-slate-400">USDT</span>
              </p>
              <p className="text-xs text-emerald-400 font-bold mt-2 flex items-center gap-1">
                 <TrendingUp className="w-3 h-3" /> Capital ganado 100% Retirable
              </p>
          </div>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-center">
            <h3 className="font-bold text-slate-200 mb-2">Estado de Delegación</h3>
            <div className="flex gap-4">
                <div className="flex flex-col">
                   <p className="text-slate-400 text-sm">Órdenes Asignadas ({activeBankTab})</p>
                   <p className="text-2xl font-bold text-orange-400 flex items-center gap-2"><Clock className="w-5 h-5"/> {filteredAssignedOrders.length}</p>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-4">
                   <p className="text-slate-400 text-sm">Transferencias Exitosas Totales</p>
                   <p className="text-2xl font-bold text-emerald-400 flex items-center gap-2"><CheckCircle className="w-5 h-5"/> {completedTransfers}</p>
                </div>
            </div>
        </div>
      </div>

      {filteredAssignedOrders.filter((o: any) => o.status === 'ASSIGNED').length > 0 && (
         <div className="bg-slate-900/80 backdrop-blur-xl border border-orange-500/30 rounded-2xl overflow-hidden shadow-[0_0_30px_-5px_rgba(249,115,22,0.15)] relative">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
                <h2 className="font-bold text-orange-400 text-lg flex items-center gap-2">
                   <Clock className="w-5 h-5"/> Mis Órdenes Pendientes de Pago
                </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-950/80">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap">Órdenes</th>
                    <th className="px-6 py-4 whitespace-nowrap">Monto Fiat a Enviar</th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAssignedOrders.filter((o: any) => o.status === 'ASSIGNED').map((o: any) => (
                      <tr key={o.bybitOrderId} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-5 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {o.bybitOrderId}
                          <br />
                          {(o.side === 'BUY' || o.retailName?.includes('[COMPRA]')) && <span className="text-emerald-400 font-bold tracking-widest text-[10px] uppercase mt-1 inline-block">🔵 COMPRA</span>}
                          {(o.side === 'SELL' || o.retailName?.includes('[VENTA]')) && <span className="text-rose-400 font-bold tracking-widest text-[10px] uppercase mt-1 inline-block">🔴 VENTA</span>}
                          <P2pCountdown createdAt={o.createdAt || o.updatedAt} status={o.status} />
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                            <p className="font-black text-white text-lg">{Number(o.amountFiat).toLocaleString()} {o.currencyId || 'VES'}</p>
                        </td>
                        <td className="px-6 py-5 text-right flex justify-end gap-2 text-xs whitespace-nowrap">
                           <button 
                               onClick={() => handleViewPaymentDetails(o.bybitOrderId)}
                               className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded shadow transition-all flex items-center gap-2"
                           >
                              <Eye className="w-4 h-4"/> Ver Pago
                           </button>
                           <button 
                               onClick={() => handleMarkAsPaid(o.bybitOrderId)}
                               className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded shadow transition-all"
                           >
                              Ya Transferí
                           </button>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
         </div>
      )}

      {filteredAssignedOrders.filter((o: any) => o.status === 'PAYMENT_SENT').length > 0 && (
         <div className="bg-slate-900/80 backdrop-blur-xl border border-indigo-500/30 rounded-2xl overflow-hidden shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)] relative">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
                <h2 className="font-bold text-indigo-400 text-lg flex items-center gap-2">
                   <CheckCircle className="w-5 h-5"/> Pendientes por Liberar
                </h2>
                <span className="text-xs text-indigo-300">Pagos informados. Esperando contraparte.</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-indigo-200">
                <thead className="text-xs text-indigo-300 uppercase bg-slate-950/80">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap">Órdenes</th>
                    <th className="px-6 py-4 whitespace-nowrap">Monto Pagado</th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAssignedOrders.filter((o: any) => o.status === 'PAYMENT_SENT').map((o: any) => (
                      <tr key={o.bybitOrderId} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-5 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {o.bybitOrderId}
                          <br />
                          {(o.side === 'BUY' || o.retailName?.includes('[COMPRA]')) && <span className="text-emerald-400 font-bold tracking-widest text-[10px] uppercase mt-1 inline-block">🔵 COMPRA</span>}
                          {(o.side === 'SELL' || o.retailName?.includes('[VENTA]')) && <span className="text-rose-400 font-bold tracking-widest text-[10px] uppercase mt-1 inline-block">🔴 VENTA</span>}
                          <P2pCountdown createdAt={o.createdAt || o.updatedAt} status={o.status} />
                        </td>
                        <td className="px-6 py-5 font-bold whitespace-nowrap">{Number(o.amountFiat).toLocaleString()} {o.currencyId || 'VES'}</td>
                        <td className="px-6 py-5 text-right font-mono text-indigo-400 whitespace-nowrap">En Espera de Cripto</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
         </div>
      )}

      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
              <h2 className="font-bold text-white text-lg flex items-center gap-2">
                 <Link2 className="w-5 h-5 text-indigo-400"/> Order Book Local - {activeBankTab}
              </h2>
              <div className="flex items-center gap-3">
                  <select
                      value={fiatFilter}
                      onChange={(e) => setFiatFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-sm outline-none cursor-pointer hover:border-indigo-500/50 transition-colors"
                  >
                      <option value="ALL">Todas las Monedas</option>
                      {Array.from(new Set(orders.map((o: any) => o.currencyId || 'VES'))).map((fiat: any) => (
                          <option key={fiat} value={fiat}>{fiat}</option>
                      ))}
                  </select>
                  <span className="hidden md:flex items-center gap-2 text-xs font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                     <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                     Escáner de ByBit Activo
                  </span>
              </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950/80">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Órdenes</th>
                  <th className="px-6 py-4 whitespace-nowrap">Monto Fiat a Enviar</th>
                  <th className="px-6 py-4 whitespace-nowrap">Recompensa (Cripto)</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                       <div className="flex flex-col items-center justify-center">
                          <RefreshCw className="w-8 h-8 text-slate-600 animate-spin-slow mb-3" />
                          <p>Buscando órdenes nuevas de {activeBankTab} en la Agencia...</p>
                       </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o: any) => (
                    <tr key={o.bybitOrderId} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-5 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {o.bybitOrderId}
                          <br />
                          {(o.side === 'BUY' || o.retailName?.includes('[COMPRA]')) && <span className="text-emerald-400 font-bold tracking-widest text-[10px] uppercase mt-1 inline-block">🔵 COMPRA</span>}
                          {(o.side === 'SELL' || o.retailName?.includes('[VENTA]')) && <span className="text-rose-400 font-bold tracking-widest text-[10px] uppercase mt-1 inline-block">🔴 VENTA</span>}
                          <P2pCountdown createdAt={o.createdAt || o.updatedAt} status={o.status} />
                          {o.assignedUser && (
                              <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-400 font-bold px-2 py-1 bg-indigo-500/10 rounded border border-indigo-500/20 w-fit">
                                  <span>T/ {o.assignedUser.alias}</span>
                              </div>
                          )}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                          <p className="font-black text-white text-lg">{Number(o.amountFiat).toLocaleString()} {o.currencyId || 'VES'}</p>
                          <p className="text-xs text-slate-500">Vía {activeBankTab}</p>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                          <p className="font-black text-emerald-400 text-lg">+{(Number(o.amountUsdt || o.quantity)).toFixed(2)} {o.tokenId || 'USDT'}</p>
                      </td>
                      <td className="px-6 py-5 text-right whitespace-nowrap">
                         {o.assignedUser ? (
                              <span className="text-slate-500 text-xs font-bold uppercase bg-slate-800 px-3 py-1.5 rounded border border-slate-700">Asignada</span>
                         ) : (
                             <button 
                                 onClick={() => handleTakeOrder(o.bybitOrderId)}
                                 className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-2 px-6 rounded-lg shadow-[0_0_15px_-3px_rgba(99,102,241,0.5)] transition-all group-hover:scale-105 active:scale-95"
                             >
                                Tomar Orden
                             </button>
                         )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      </div>

      {selectedOrderDetails && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
             <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh] relative custom-scrollbar">
                <button onClick={() => setSelectedOrderDetails(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                   <X className="w-5 h-5" />
                </button>
                <div className="p-6">
                   <h3 className="text-xl font-bold text-white mb-1">Detalles de Pago</h3>
                   <p className="text-sm font-mono text-slate-400 mb-6">Órden #{selectedOrderDetails.orderId}</p>

                   {(() => {
                        const order = assignedOrders.find((o: any) => o.bybitOrderId === selectedOrderDetails.orderId);
                        return order ? (
                             <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg mb-6 flex flex-col items-center">
                                <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Total a Transferir</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-black text-2xl">{Number(order.amountFiat).toLocaleString()} {order.currencyId || 'VES'}</span>
                                  <button onClick={() => navigator.clipboard.writeText(Number(order.amountFiat).toFixed(2).replace('.', ','))} className="text-emerald-500/50 hover:text-emerald-400 transition-colors">
                                     <Copy className="w-5 h-5"/>
                                  </button>
                                </div>
                             </div>
                        ) : null;
                   })()}

                   {loadingDetails ? (
                      <div className="animate-pulse space-y-4">
                         <div className="h-4 bg-slate-800 rounded w-1/2"></div>
                         <div className="h-10 bg-slate-800 rounded w-full mt-4"></div>
                         <div className="h-10 bg-slate-800 rounded w-full"></div>
                      </div>
                   ) : (
                      <>
                         {selectedOrderDetails.result?.identityNo ? (
                             <>
                                 <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded mb-2 flex justify-between items-center shadow-inner">
                                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Documento (ID)</span>
                                    <div className="flex items-center gap-2">
                                       <span className="text-white font-mono text-lg">{selectedOrderDetails.result.identityNo}</span>
                                       <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.result.identityNo)} className="text-slate-400 hover:text-white transition-colors">
                                          <Copy className="w-4 h-4"/>
                                        </button>
                                    </div>
                                 </div>
                                 {selectedOrderDetails.result.chatDetectedBank && (
                                     <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded mb-2 flex justify-between items-center shadow-inner">
                                        <span className="text-blue-400 text-xs font-bold uppercase tracking-widest">BANCO CHAT</span>
                                        <div className="flex items-center gap-2">
                                           <span className="text-white font-mono text-lg">{selectedOrderDetails.result.chatDetectedBank}</span>
                                           <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.result.chatDetectedBank)} className="text-slate-400 hover:text-white transition-colors">
                                              <Copy className="w-4 h-4"/>
                                           </button>
                                        </div>
                                     </div>
                                 )}
                                 {selectedOrderDetails.result.chatDetectedPhone && (
                                     <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded mb-2 flex justify-between items-center shadow-inner">
                                        <span className="text-orange-400 text-xs font-bold uppercase tracking-widest">TELÉFONO PAGO MÓVIL CHAT</span>
                                        <div className="flex items-center gap-2">
                                           <span className="text-white font-mono text-lg">{selectedOrderDetails.result.chatDetectedPhone}</span>
                                           <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.result.chatDetectedPhone)} className="text-slate-400 hover:text-white transition-colors">
                                              <Copy className="w-4 h-4"/>
                                           </button>
                                        </div>
                                     </div>
                                 )}
                                 {selectedOrderDetails.result.chatDetectedAccount && (
                                     <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded mb-4 flex justify-between items-center shadow-inner">
                                        <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">CUENTA CHAT</span>
                                        <div className="flex items-center gap-2">
                                           <span className="text-white font-mono text-lg">{selectedOrderDetails.result.chatDetectedAccount}</span>
                                           <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.result.chatDetectedAccount)} className="text-slate-400 hover:text-white transition-colors">
                                              <Copy className="w-4 h-4"/>
                                           </button>
                                        </div>
                                     </div>
                                 )}
                             </>
                         ) : (
                             <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg mb-4 text-center">
                                <p className="text-xs text-rose-400 font-bold mb-2">Cédula o Cuenta no detectada por el sistema</p>
                                <button
                                    onClick={() => handleRequestCI(selectedOrderDetails.orderId)}
                                    disabled={requestingCI}
                                    className="w-full bg-rose-500 hover:bg-rose-400 text-white py-2 rounded text-xs font-bold transition-all disabled:opacity-50 shadow-md"
                                >
                                    {requestingCI ? 'Enviando...' : 'Pedir Datos por Chat Automáticamente'}
                                </button>
                             </div>
                         )}
                         {selectedOrderDetails.result?.paymentTermList ? (
                            <div className="space-y-4">
                               {selectedOrderDetails.result.paymentTermList.map((p: any, idx: number) => (
                               <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                  <div className="flex justify-between items-center mb-2">
                                     <p className="text-emerald-400 font-bold text-sm uppercase">{p.bankName || 'MÉTODO ' + (idx+1)}</p>
                                     <button 
                                        onClick={() => {
                                            const fallbackAcc = Object.entries(p).find(([k, v]) => k.toLowerCase().includes('message') && v)?.[1];
                                            const chatPhone = selectedOrderDetails.result?.chatDetectedPhone;
                                            const chatAcc = selectedOrderDetails.result?.chatDetectedAccount;
                                            const acc = p.accountNo || fallbackAcc || chatPhone || chatAcc || '';
                                            const ciEntry = Object.entries(p).find(([k, v]) => (k.toLowerCase().includes('paymentext') || k.toLowerCase().includes('paymenttext')) && v && String(v).trim().length > 0);
                                            const fallbackCi = ciEntry ? String(ciEntry[1]).trim() : '';
                                            const idNo = selectedOrderDetails.result?.identityNo ? String(selectedOrderDetails.result.identityNo).trim() : '';
                                            const rawCi = (idNo.length > 2 && idNo !== 'null' && idNo !== '-') ? idNo : fallbackCi;
                                            const order = assignedOrders.find((o: any) => o.bybitOrderId === selectedOrderDetails.orderId);
                                            const amt = order ? Number(order.amountFiat).toFixed(2).replace('.', ',') : '0,00';
                                            const textToCopy = `${acc}\n${rawCi}\n${amt}`;
                                            console.log("Intentando copiar:", textToCopy);
                                            navigator.clipboard.writeText(textToCopy)
                                                .then(() => alert(`¡Copiado con éxito!\n\nCuenta: ${acc}\nCI: ${rawCi}\nMonto: ${amt}`))
                                                .catch((err) => alert(`Error al copiar (Posible restricción del navegador Safari/Chrome): ${err}`));
                                        }}
                                        title="Copiar Cuenta, Cédula y Monto"
                                        className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded px-2 py-1 flex items-center gap-1 text-xs font-bold transition-all shadow-sm"
                                     >
                                         <Copy className="w-3 h-3" /> Master
                                     </button>
                                  </div>
                                  <div className="space-y-3 text-sm font-mono text-slate-300">
                                      <p className="flex justify-between items-center group">
                                         <span className="text-slate-500">CTA:</span> 
                                         <span className="flex items-center gap-2">{p.accountNo || selectedOrderDetails.result?.chatDetectedAccount || '-'} <button onClick={() => navigator.clipboard.writeText(p.accountNo || selectedOrderDetails.result?.chatDetectedAccount || '')} className="text-slate-500 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button></span>
                                      </p>
                                      {Object.entries(p).find(([k, v]) => k.toLowerCase().includes('message') && v)?.[1] && (
                                      <div className="bg-yellow-500/10 border border-yellow-500/30 p-2 rounded mt-2">
                                         <span className="text-yellow-600/80 text-xs font-bold uppercase tracking-widest block mb-1">Nota del Vendedor:</span>
                                         <span className="text-yellow-400 font-mono text-sm whitespace-pre-wrap break-all">{Object.entries(p).find(([k, v]) => k.toLowerCase().includes('message') && v)?.[1] as string}</span>
                                      </div>
                                      )}
                                      <p className="flex justify-between items-center group">
                                         <span className="text-slate-500">TITULAR:</span> 
                                         <span className="flex items-center gap-2">{p.realName} <button onClick={() => navigator.clipboard.writeText(p.realName)} className="text-slate-500 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button></span>
                                      </p>
                                      {Object.entries(p).map(([k, v]) => {
                                          if (typeof v !== 'string' || !v || ['accountNo', 'paymessage', 'payMessage', 'realName', 'paymentType', 'bankName', 'paymentId', 'id', 'online'].includes(k)) return null;
                                          let label = k;
                                          if (k.toLowerCase().includes('paymentext') || k.toLowerCase().includes('paymenttext')) label = 'CÉDULA';
                                          return (
                                             <p key={k} className="flex justify-between items-center group">
                                                <span className="text-slate-500 uppercase">{label}:</span> 
                                                <span className="flex items-center gap-2">{v as string} <button onClick={() => navigator.clipboard.writeText(v as string)} className="text-slate-500 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button></span>
                                             </p>
                                          );
                                      })}
                                  </div>
                               </div>
                            ))}
                         </div>
                      ) : (
                         <p className="text-rose-400 text-sm">No se encontraron métodos de pago o hubo un error al leer la API de ByBit.</p>
                      )}
                      
                      <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl p-5">
                          <h4 className="font-bold text-white mb-3 flex items-center gap-2">Confirmación de Pago</h4>
                          <p className="text-xs text-slate-400 mb-4">Sube la captura de pantalla de la transferencia. El sistema optimizará la imagen y le enviará el comprobante a la contraparte por chat antes de confirmar a Bybit.</p>
                          
                          <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleFileChange}
                              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 mb-4 cursor-pointer"
                          />
                          
                          {receiptImageBase64 && (
                              <div className="mb-4 rounded-lg overflow-hidden border border-emerald-500/30 max-h-48 relative">
                                  <img src={receiptImageBase64} alt="Preview" className="w-full object-cover" />
                                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent flex items-end p-2 pointer-events-none"></div>
                              </div>
                          )}

                          <button
                              onClick={() => handleMarkAsPaidWithReceipt(selectedOrderDetails.orderId)}
                              disabled={isSendingReceipt || !receiptImageBase64}
                              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 rounded-lg text-sm font-bold transition-all shadow-md flex justify-center items-center gap-2"
                          >
                              {isSendingReceipt ? 'Subiendo e Informando P2P...' : 'Informar Pago con Comprobante'}
                          </button>
                      </div>
                      </>
                   )}
                </div>
             </div>
          </div>
      )}
    </div>
  );
}
