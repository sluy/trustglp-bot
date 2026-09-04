'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Wallet, Link2, TrendingUp, CheckCircle, Clock, RefreshCw, Eye, X, Copy, Users, Layers } from 'lucide-react';

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

export function OperadorP2pView({ alias, userId }: { alias: string; userId: number }) {
  const profile = { id: userId, alias, p2pUsdtBalance: 0 };
  const [orders, setOrders] = useState([]);
  const [assignedOrders, setAssignedOrders] = useState([]);
  const [fiatFilter, setFiatFilter] = useState('ALL');
  const prevBybitOrdersRef = useRef<any[]>([]);
  const prevBinanceOrdersRef = useRef<any[]>([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [requestingCI, setRequestingCI] = useState(false);
  const [receiptImageBase64, setReceiptImageBase64] = useState<string | null>(null);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  const [p2pBalance, setP2pBalance] = useState(0);
  const [completedTransfers, setCompletedTransfers] = useState(0);
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);

  useEffect(() => {
    if (userId) {
      fetch(`/api/operators/${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setP2pBalance(data.p2pUsdtBalance || 0);
            setCompletedTransfers(data.completedOrders || 0);
          }
        })
        .catch(() => {});
    }
  }, [userId]);
  const [activeBankTab, setActiveBankTab] = useState<string>('General');
  const [activeTabs, setActiveTabs] = useState<{ id: string; label: string; emoji: string }[]>([]);

  useEffect(() => {
    // Cargar métodos de pago activos desde localStorage (fuente de verdad)
    try {
      const saved = localStorage.getItem('telecambios_ve_payment_methods');
      if (saved) {
        const methods = JSON.parse(saved);
        const active = methods
          .filter((m: any) => m.enabled)
          .map((m: any) => ({
            id: m.id,
            label: m.name,
            emoji: m.type === 'mobile_payment' ? '📱' : m.type === 'digital_wallet' ? '💳' : '🏦',
            bybitCodes: m.bybitCodes || [],
            binanceCodes: m.binanceCodes || [],
          }));
        setActiveTabs(active);
      }
    } catch {}
  }, []);


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

  const [allAssignments, setAllAssignments] = useState<Record<string, any>>({});
  const locallyPaidOrderIdsRef = useRef<Set<string>>(new Set());
  const locallyAssignedOrderIdsRef = useRef<Set<string>>(new Set());

  const fetchOrders = async () => {
    try {
      // 1. Fetch Assignments
      const assignRes = await fetch('/api/orders/assignments');
      const assignments = assignRes.ok ? await assignRes.json() : {};
      setAllAssignments(assignments);

      // 2. Fetch Both Exchanges
      const [bybitRes, binanceRes] = await Promise.allSettled([
        fetch('/api/bybit/orders'),
        fetch('/api/binance/orders'),
      ]);

      const bybitOrders: any[] = [];
      const binanceOrders: any[] = [];

      if (bybitRes.status === 'fulfilled' && bybitRes.value.ok) {
        const data = await bybitRes.value.json();
        if (data.orders && !data.error) {
           bybitOrders.push(...data.orders);
           prevBybitOrdersRef.current = data.orders;
        } else {
           bybitOrders.push(...prevBybitOrdersRef.current);
        }
      } else {
        bybitOrders.push(...prevBybitOrdersRef.current);
      }

      if (binanceRes.status === 'fulfilled' && binanceRes.value.ok) {
        const data = await binanceRes.value.json();
        if (data.orders && !data.error) {
           binanceOrders.push(...data.orders);
           prevBinanceOrdersRef.current = data.orders;
        } else {
           binanceOrders.push(...prevBinanceOrdersRef.current);
        }
      } else {
        binanceOrders.push(...prevBinanceOrdersRef.current);
      }

      const merged = [...bybitOrders, ...binanceOrders].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Separar asignadas vs pendientes
      const myAssigned: any[] = [];
      const pending: any[] = [];

      merged.forEach(o => {
        const oId = (o.bybitOrderId || o.binanceOrderId) || o.binanceOrderId;
        
        if (locallyPaidOrderIdsRef.current.has(oId) && !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(o.status)) {
            o.status = 'PAGO RECIBIDO';
        }

        const assignment = assignments[oId];
        const isLocallyAssigned = locallyAssignedOrderIdsRef.current.has(oId);
        
        if (assignment || isLocallyAssigned) {
           o.assignedUser = assignment 
              ? { alias: assignment.operatorName, operatorId: assignment.operatorId }
              : { alias: profile.alias, operatorId: profile.id };
           
           if (isLocallyAssigned || String(assignment?.operatorId) === String(profile.id)) {
             // Avoid duplicating it in myAssigned if it's already there
             if (!myAssigned.some(existing => (existing.bybitOrderId || existing.binanceOrderId) === oId)) {
                myAssigned.push(o);
             }
           }
        }
        pending.push(o); // Todo va al Order Book general
      });

      // Ordenamiento local del Order Book:
      // Nuevas arriba (b - a), pero las asignadas se van al fondo.
      pending.sort((a, b) => {
          const aAssigned = !!a.assignedUser;
          const bAssigned = !!b.assignedUser;
          if (aAssigned && !bAssigned) return 1; // a va al fondo
          if (!aAssigned && bAssigned) return -1; // b va al fondo
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // nuevas arriba
      });

      setAssignedOrders(myAssigned as any);
      setOrders(pending as any);

    } catch (e) {
      console.error("Error fetching orders:", e);
    }
  };

  const syncAssignments = useCallback(async () => {
    try {
      const assignRes = await fetch('/api/orders/assignments');
      if (!assignRes.ok) return;
      const assignments = await assignRes.json();
      setAllAssignments(assignments);

      setOrders((prev: any[]) => {
        let changed = false;
        const next = [...prev];
        for (let i = 0; i < next.length; i++) {
          const o = next[i];
          const oId = o.bybitOrderId || o.binanceOrderId;
          const isLocallyAssigned = locallyAssignedOrderIdsRef.current.has(oId);
          if (assignments[oId] || isLocallyAssigned) {
            const opId = assignments[oId] ? assignments[oId].operatorId : profile.id;
            const opName = assignments[oId] ? assignments[oId].operatorName : profile.alias;
            if (!o.assignedUser || o.assignedUser.operatorId !== opId) {
              o.assignedUser = { alias: opName, operatorId: opId };
              changed = true;
            }
          } else {
            if (o.assignedUser && !isLocallyAssigned) {
              o.assignedUser = undefined;
              changed = true;
            }
          }
        }
        if (changed) {
          next.sort((a, b) => {
            const aAssigned = !!a.assignedUser;
            const bAssigned = !!b.assignedUser;
            if (aAssigned && !bAssigned) return 1;
            if (!aAssigned && bAssigned) return -1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          return next;
        }
        return prev;
      });
    } catch (e) {}
  }, [profile.id, profile.alias]);

  useEffect(() => {
    if (!profile.id) return;
    fetchOrders();
    const int = setInterval(fetchOrders, 4000); // Se actualizó de 10s a 4s para mayor rapidez
    const intAssign = setInterval(syncAssignments, 1000); // Polling de asignaciones ultra-rápido
    return () => {
        clearInterval(int);
        clearInterval(intAssign);
    };
  }, [profile.id, syncAssignments]);

  const handleTakeOrder = async (orderId: string) => {
      const confirmAction = confirm(`¿Deseas tomar la orden ${orderId} y realizar el pago Fiat?`);
      if(confirmAction) {
         // Optimistic UI update
         locallyAssignedOrderIdsRef.current.add(orderId);
         setOrders(prev => {
             const idx = prev.findIndex((o: any) => (o.bybitOrderId || o.binanceOrderId) === orderId);
             if (idx > -1) {
                 const order = { ...prev[idx], assignedUser: { alias: profile.alias, operatorId: profile.id } };
                 setAssignedOrders((prevAss: any) => [order, ...prevAss]);
                 const next = [...prev];
                 next.splice(idx, 1);
                 return next;
             }
             return prev;
         });

         try {
            const res = await fetch(`/api/orders/assignments`, {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ orderId, operatorId: profile.id, operatorName: profile.alias })
            });

            if(res.ok) {
               const data = await res.json();
               if (!data.ok) {
                   alert(data.error || 'La orden ya no está disponible.');
                   locallyAssignedOrderIdsRef.current.delete(orderId);
                   fetchOrders(); // rollback
                   return;
               }
               console.log(`Orden ${orderId} asignada. Revisa tus pagos pendientes y transfiere.`);
               fetchOrders();
            } else {
               alert('Ocurrió un error de red al asignar la orden.');
               locallyAssignedOrderIdsRef.current.delete(orderId);
               fetchOrders(); // rollback
            }
         } catch(e) {
            alert('Error de conexión con el servidor.');
            locallyAssignedOrderIdsRef.current.delete(orderId);
            fetchOrders(); // rollback
         }
      }
  };


  const handleReleaseOrder = async (orderId: string) => {
      const confirmAction = confirm(`¿Seguro que deseas liberar la orden ${orderId}? Volverá al Order Book para que otro operador pueda tomarla.`);
      if(confirmAction) {
         // Optimistic UI update
         locallyAssignedOrderIdsRef.current.delete(orderId);
         setAssignedOrders(prev => {
             const idx = prev.findIndex((o: any) => (o.bybitOrderId || o.binanceOrderId) === orderId);
             if (idx > -1) {
                 const order = { ...prev[idx] };
                 delete order.assignedUser;
                 setOrders((prevOrders: any) => [order, ...prevOrders]);
                 const next = [...prev];
                 next.splice(idx, 1);
                 return next;
             }
             return prev;
         });

         try {
            const res = await fetch(`/api/orders/assignments?orderId=${orderId}`, {
               method: 'DELETE'
            });

            if(res.ok) {
               console.log(`Orden ${orderId} liberada correctamente.`);
               fetchOrders();
            } else {
               alert('Ocurrió un error al liberar la orden.');
               fetchOrders(); // rollback
            }
         } catch(e) {
            alert('Error de conexión con el servidor.');
            fetchOrders(); // rollback
         }
      }
  };

  const updateOperatorStats = async (order: any) => {
    if (!userId || !order) return;
    try {
      const usdt = Number(order.amountUsdt || order.quantity || 0);
      const fiat = Number(order.amountFiat || order.amount || 0);
      
      await fetch(`/api/operators/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'increment_stats',
          amountUsdt: usdt,
          amountFiat: fiat,
          profitUsdt: usdt
        })
      });
      setP2pBalance(prev => prev + usdt);
      setCompletedTransfers(prev => prev + 1);
    } catch {}
  };

  const handleMarkAsPaid = async (orderId: string) => {
    if (!confirm('¿Has realizado el pago? Esto no se puede deshacer.')) return;
    const order = assignedOrders.find((o: any) => (o.bybitOrderId || o.binanceOrderId) === orderId) || selectedOrderDetails;
    const previousOrderDetails = selectedOrderDetails;
    
    // Optimistic UI update: mover a "Pendientes por Liberar"
    setSelectedOrderDetails(null);
    locallyPaidOrderIdsRef.current.add(orderId);
    setAssignedOrders(prev => prev.map((o: any) => {
        if ((o.bybitOrderId || o.binanceOrderId) === orderId) {
            return { ...o, status: 'PAGO RECIBIDO' };
        }
        return o;
    }));

    try {
      const isBinance = order?.exchange === 'binance';

      if (isBinance) {
        const payId = order?.counterparty?.result?.payId || '';
        const res = await fetch(`/api/binance/order/${orderId}/mark-paid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payId })
        });
        const data = await res.json();
        if (data.ok) {
          console.log('✅ Orden marcada como Pagada en Binance P2P.');
          if (order) await updateOperatorStats(order);
          fetchOrders();
        } else {
          console.error(`❌ Error Binance: ${data.error}`);
          alert(`❌ Error Binance: ${data.error}`);
          setSelectedOrderDetails(previousOrderDetails);
          fetchOrders();
        }
      } else {
        const res = await fetch(`/api/bybit/order/${orderId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_paid' })
        });
        const data = await res.json();
        if (data.ok) {
          console.log('Orden marcada como Pagada en Bybit.');
          if (order) await updateOperatorStats(order);
          fetchOrders();
        } else {
          console.error(`Error: ${data.error}`);
          alert(`Error: ${data.error}`);
          setSelectedOrderDetails(previousOrderDetails);
          fetchOrders();
        }
      }
    } catch(e) {
      console.error('Error procesando el pago.', e);
      alert('Error procesando el pago.');
      setSelectedOrderDetails(previousOrderDetails);
      fetchOrders();
    }
  };

  const handleMarkAsPaidWithReceipt = async (orderId: string) => {
     if (!receiptImageBase64) return alert("Sube el comprobante primero.");
     const confirmAction = confirm('¿Confirmas que ya realizaste la transferencia y deseas marcar esta orden como PAGADA?');
     if (!confirmAction) return;

     const order = assignedOrders.find((o: any) => (o.bybitOrderId || o.binanceOrderId) === orderId) || selectedOrderDetails;
     const previousOrderDetails = selectedOrderDetails;
     const isBinance = order?.exchange === 'binance';

     // Optimistic UI update: mover a "Pendientes por Liberar"
     setReceiptImageBase64(null);
     setSelectedOrderDetails(null);
     locallyPaidOrderIdsRef.current.add(orderId);
     setAssignedOrders(prev => prev.map((o: any) => {
         if ((o.bybitOrderId || o.binanceOrderId) === orderId) {
             return { ...o, status: 'PAGO RECIBIDO' };
         }
         return o;
     }));
     setIsSendingReceipt(true);

     try {
         if (isBinance) {
           const b64Data = receiptImageBase64.split(',')[1];
           const byteArr = Uint8Array.from(atob(b64Data), c => c.charCodeAt(0));
           const blob = new Blob([byteArr], { type: 'image/jpeg' });
           const formData = new FormData();
           formData.append('image', blob, `comprobante_${orderId}.jpg`);

           const uploadRes = await fetch(`/api/binance/order/${orderId}/upload-proof`, {
             method: 'POST',
             body: formData,
           });
           const uploadData = await uploadRes.json();

           if (!uploadData.ok) {
             console.error(`❌ Error subiendo imagen a Binance: ${uploadData.error}`);
             alert(`❌ Error subiendo imagen a Binance: ${uploadData.error}`);
             setSelectedOrderDetails(previousOrderDetails);
             fetchOrders();
             return;
           }

           const payId = order?.counterparty?.result?.payId || '';
           const paidRes = await fetch(`/api/binance/order/${orderId}/mark-paid`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ payId }),
           });
           const paidData = await paidRes.json();

           const lines = ['✅ Binance - Proceso ejecutado:'];
           lines.push(uploadData.ok ? '📎 Comprobante enviado al chat de Binance' : '⚠️ Imagen no enviada');
           lines.push(paidData.ok ? '✅ Orden marcada como Pagada' : `⚠️ Pago: ${paidData.error || 'no confirmado'}`);
           console.log(lines.join('\n'));

           if (paidData.ok) {
             if (order) await updateOperatorStats(order);
           }
           fetchOrders();

         } else {
           // ── FLUJO BYBIT ──────────────────────────────────────────────────────────
            // 1. Subir imagen y obtener URL corta segura
            const uploadRes = await fetch(`/api/bybit/receipt/upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: receiptImageBase64 }),
            });
            const uploadData = await uploadRes.json();

            if (!uploadData.ok) {
              console.error(`❌ Error guardando imagen Bybit: ${uploadData.error}`);
              alert(`❌ Error guardando imagen Bybit: ${uploadData.error}`);
              setSelectedOrderDetails(previousOrderDetails);
              fetchOrders();
              return;
            }

            // 2. Enviar URL al chat de Bybit y marcar pagado
            const paidRes = await fetch(`/api/bybit/order/${orderId}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'pay_with_receipt', receiptUrl: uploadData.url }),
            });
            const paidData = await paidRes.json();

            const lines = ['✅ Bybit - Proceso ejecutado:'];
            lines.push(uploadData.ok ? '📎 Comprobante guardado y enviado al chat' : '⚠️ Imagen no guardada');
            lines.push(paidData.ok ? '✅ Orden marcada como Pagada' : `⚠️ Pago: ${paidData.error || 'no confirmado'}`);
            console.log(lines.join('\n'));

            if (paidData.ok) {
                if (order) await updateOperatorStats(order);
            }
            fetchOrders();
         }
     } catch (e) {
         console.error('Error subiendo comprobante.', e);
         alert('Error subiendo comprobante.');
         setSelectedOrderDetails(previousOrderDetails);
         fetchOrders();
     } finally {
         setIsSendingReceipt(false);
     }
  };

    const handleViewPaymentDetails = async (o: any) => {
    setSelectedOrderDetails({ ...o, counterparty: null });
    setLoadingDetails(true);

    try {
      if (o.exchange === 'bybit' || !o.exchange) {
        const res = await fetch(`/api/bybit/order/${o.bybitOrderId || o.orderId}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedOrderDetails({ ...o, counterparty: data });
        } else {
          setSelectedOrderDetails({ ...o, counterparty: { result: null, error: 'Error al conectar con Bybit' } });
        }
      } else {
        const amountFiat = o.amountFiat || o.amount || '';
        setSelectedOrderDetails({
          ...o,
          amountFiat,
          counterparty: {
            result: {
              buyerRealName:  o.buyerRealName  || null,
              sellerRealName: o.sellerRealName || null,
              identityNo: null,
              chatDetectedAccount: null,
              paymentTermList: o.paymentMethod ? [{
                paymentType: o.paymentMethod,
                accountNo: null,
                realName: o.buyerRealName || null,
              }] : [],
            }
          }
        });
        
        try {
          const detailRes = await fetch(`/api/binance/order/${o.binanceOrderId || o.orderId}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            if (detail.ok && detail.result) {
              const dr = detail.result;
              setSelectedOrderDetails((prev: any) => ({
                ...prev,
                amountFiat: dr.totalPrice || amountFiat,
                counterparty: {
                  result: {
                    buyerRealName:  dr.buyerRealName || o.buyerRealName || null,
                    sellerRealName: dr.sellerRealName || null,
                    identityNo:     dr.identityNo || null,
                    chatDetectedAccount: dr.chatDetectedAccount || null,
                    chatDetectedCedula:  dr.chatDetectedCedula  || null,
                    accountHolder:       dr.accountHolder || dr.buyerRealName || null,
                    payId:               dr.payId || null,
                    paymentTermList: [{
                      paymentType: dr.paymentType || o.paymentMethod || 'Banco',
                      accountNo:   dr.chatDetectedAccount || dr.accountNo || null,
                      realName:    dr.accountHolder || dr.buyerRealName || o.buyerRealName || null,
                      bankName:    dr.bankName || null,
                    }],
                  }
                }
              }));
            }
          }
        } catch(e2) {
          console.warn('[Binance detail]', e2);
        }
      }
    } catch(e) {
       console.error("Fallo obteniendo KYC/Banco", e);
       setSelectedOrderDetails({ ...o, counterparty: { result: null, error: 'Error de red' } });
    } finally {
       setLoadingDetails(false);
    }
  };

  const chatPollRef = useRef<NodeJS.Timeout | null>(null);

  const handleSendChat = async () => {
     if(!chatMessage.trim() || !selectedOrderDetails) return;
     setIsSendingChat(true);
     try {
        const isBinance = selectedOrderDetails.exchange === 'binance';
        const orderId = selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId;
        const url = isBinance 
            ? `/api/binance/order/${orderId}/chat/send` 
            : `/api/bybit/order/${orderId}/chat`;
        
        const body = isBinance
            ? { textContent: chatMessage }
            : { action: 'send_message', message: chatMessage };

        const res = await fetch(url, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.ok || data.success) {
           setChatMessage("");
           alert(`🚀 Mensaje enviado al chat de ${isBinance ? 'Binance' : 'Bybit'} con éxito.`);
        } else {
           alert(`Error: ${data.error || 'Fallo desconocido'}`);
        }
     } catch(e) {
        console.error(e);
        alert('Error de conexión al enviar mensaje.');
     } finally {
        setIsSendingChat(false);
     }
  };

  const refreshChatData = useCallback(async (orderId: string, exchangeType: string) => {
    try {
      if (exchangeType === 'binance') {
        const orderRes = await fetch(`/api/binance/order/${orderId}`, { cache: 'no-store' });
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          if (orderData.ok && (orderData.result?.chatDetectedAccount || orderData.result?.chatDetectedCedula)) {
            setSelectedOrderDetails((prev: any) => {
              if (!prev || (prev.bybitOrderId !== orderId && prev.orderId !== orderId)) return prev;
              return {
                ...prev,
                counterparty: {
                  ...prev.counterparty,
                  result: {
                    ...prev.counterparty?.result,
                    chatDetectedAccount: prev.counterparty?.result?.chatOnlyAccount || orderData.result.chatDetectedAccount || prev.counterparty?.result?.chatDetectedAccount,
                    chatDetectedCedula:  prev.counterparty?.result?.chatOnlyCedula  || orderData.result.chatDetectedCedula  || prev.counterparty?.result?.chatDetectedCedula,
                    accountHolder:       orderData.result.accountHolder        || prev.counterparty?.result?.accountHolder,
                    payId:               orderData.result.payId                || prev.counterparty?.result?.payId,
                  }
                }
              };
            });
          }
        }

        const chatRes = await fetch(`/api/binance/order/${orderId}/chat`, { cache: 'no-store' });
        if (!chatRes.ok) return;
        const chatData = await chatRes.json();
        if (chatData.chatDetectedAccount || chatData.chatDetectedCedula || chatData.chatDetectedBank) {
          setSelectedOrderDetails((prev: any) => {
            if (!prev || (prev.bybitOrderId !== orderId && prev.orderId !== orderId)) return prev;
            return {
              ...prev,
              counterparty: {
                ...prev.counterparty,
                result: {
                  ...prev.counterparty?.result,
                  chatDetectedAccount: chatData.chatDetectedAccount || prev.counterparty?.result?.chatDetectedAccount,
                  chatDetectedCedula:  chatData.chatDetectedCedula  || prev.counterparty?.result?.chatDetectedCedula,
                  chatDetectedBank:    chatData.chatDetectedBank    || prev.counterparty?.result?.chatDetectedBank,
                  chatOnlyAccount: chatData.chatDetectedAccount,
                  chatOnlyCedula:  chatData.chatDetectedCedula,
                  chatOnlyBank:    chatData.chatDetectedBank,
                }
              }
            };
          });
        }
      } else {
        const res = await fetch(`/api/bybit/order/${orderId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setSelectedOrderDetails((prev: any) => {
          if (!prev || (prev.bybitOrderId !== orderId && prev.orderId !== orderId)) return prev;
          
          // Preservar datos de chat si el nuevo poll falló en obtenerlos
          if (data.result) {
             data.result.chatDetectedAccount = data.result.chatDetectedAccount || prev.counterparty?.result?.chatDetectedAccount;
             data.result.chatDetectedCedula = data.result.chatDetectedCedula || prev.counterparty?.result?.chatDetectedCedula;
             data.result.chatDetectedBank = data.result.chatDetectedBank || prev.counterparty?.result?.chatDetectedBank;
          }
          
          return { ...prev, counterparty: data };
        });
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    if (selectedOrderDetails?.orderId || selectedOrderDetails?.bybitOrderId) {
      const id = selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId;
      const ex = selectedOrderDetails.exchange || 'bybit';
      const interval = ex === 'binance' ? 5000 : 10000;
      refreshChatData(id, ex);
      chatPollRef.current = setInterval(() => refreshChatData(id, ex), interval);
    }
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [selectedOrderDetails?.orderId, selectedOrderDetails?.bybitOrderId, refreshChatData]);

  const handleRequestCI = async (orderId: string) => {
       const exchange = selectedOrderDetails?.exchange || 'bybit';
       
       if (exchange === 'binance') {
          setRequestingCI(true);
          try {
             const res = await fetch(`/api/binance/order/${orderId}/chat/request-data`, { method: 'POST' });
             const data = await res.json();
             if (data.ok) {
                 console.log('✅ Mensaje automatizado enviado al chat de Binance.');
             } else {
                 alert(`Error enviando mensaje: ${data.error}`);
             }
          } catch (e) {
             alert('Error conectando a la API de Chat Binance.');
          } finally {
             setRequestingCI(false);
          }
          return;
       }

       setRequestingCI(true);
       try {
          const res = await fetch(`/api/bybit/order/${orderId}/chat`, {
             method: 'POST',
             headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ action: 'request_ci' })
          });
          if(res.ok) {
              console.log('Se ha enviado el mensaje solicitando los Datos al chat de Bybit. Actualiza en unos segundos.');
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
    const tab = activeTabs.find(t => t.id === activeBankTab);
    if (!tab) return false;
    
    const payMethod = (o.paymentMethod || o.bankDetails || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const retailNameNorm = (o.retailName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const combined = payMethod + ' ' + retailNameNorm;
    const labelNorm = tab.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

    if (labelNorm.includes('pago') || labelNorm.includes('movil')) {
      return combined.includes('pago') || combined.includes('movil');
    }
    if (labelNorm.includes('mercantil')) return combined.includes('mercantil');
    if (labelNorm.includes('banesco')) return combined.includes('banesco') || (!combined.includes('mercantil') && !combined.includes('pago') && !combined.includes('movil'));

    return combined.includes(labelNorm);
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
        
        <div className="flex bg-slate-900/50 p-1 w-fit rounded-lg border border-slate-800 backdrop-blur-md relative z-20 flex-wrap gap-1">
           {/* General siempre visible */}
           <button
             className={`px-5 py-2 rounded-md font-bold text-sm transition-all ${activeBankTab === 'General' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
             onClick={() => setActiveBankTab('General')}
           >
             🌎 General
           </button>
           {/* Tabs dinámicas — solo métodos activos en Admin Config */}
           {activeTabs.map(tab => (
             <button
               key={tab.id}
               className={`px-5 py-2 rounded-md font-bold text-sm transition-all ${activeBankTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
               onClick={() => setActiveBankTab(tab.id)}
             >
               {tab.emoji} {tab.label}
             </button>
           ))}
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

      {filteredAssignedOrders.filter((o: any) => ['PENDIENTE DE PAGO', 'EN PROCESO'].includes(o.status)).length > 0 && (
         <div className="bg-slate-900/80 backdrop-blur-xl border border-orange-500/30 rounded-2xl overflow-hidden shadow-[0_0_30px_-5px_rgba(249,115,22,0.15)] relative">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
                <h2 className="font-bold text-orange-400 text-lg flex items-center gap-2">
                   <Clock className="w-5 h-5"/> Mis Órdenes Pendientes de Pago
                </h2>
            </div>
            <div className="w-full flex flex-col text-sm text-left text-slate-300">
              <div className="hidden md:grid md:grid-cols-3 text-xs text-slate-400 uppercase bg-slate-950/80 px-6 py-4">
                 <div>Órdenes</div>
                 <div>Monto Fiat a Enviar</div>
                 <div className="text-right">Acción</div>
              </div>
              <div className="flex flex-col divide-y divide-white/5">
                {filteredAssignedOrders.filter((o: any) => ['PENDIENTE DE PAGO', 'EN PROCESO'].includes(o.status)).map((o: any) => (
                    <div key={(o.bybitOrderId || o.binanceOrderId)} className="flex flex-col md:grid md:grid-cols-3 px-5 py-5 md:px-6 md:py-5 hover:bg-slate-800/50 transition-colors gap-4 md:gap-0 items-start md:items-center">
                      <div className="font-mono text-xs text-slate-400 w-full">
                        <div className="flex justify-between items-start md:block">
                          <div>
                            {(o.bybitOrderId || o.binanceOrderId)}
                            <br className="hidden md:block" />
                            <div className="flex flex-wrap gap-1 mt-1">
                              {o.exchange === 'binance' ? (
                                <span className="text-yellow-400 font-bold tracking-widest text-[10px] uppercase bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded">Binance</span>
                              ) : (
                                <span className="text-amber-400 font-bold tracking-widest text-[10px] uppercase bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">Bybit</span>
                              )}
                              {(o.tradeType === 'BUY' || o.retailName?.includes('[COMPRA]')) && <span className="text-emerald-400 font-bold tracking-widest text-[10px] uppercase bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">🔵 COMPRA</span>}
                              {(o.tradeType === 'SELL' || o.retailName?.includes('[VENTA]')) && <span className="text-rose-400 font-bold tracking-widest text-[10px] uppercase bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">🔴 VENTA</span>}
                            </div>
                          </div>
                          <div className="md:mt-1 text-right md:text-left">
                            <P2pCountdown createdAt={o.createdAt || o.updatedAt} status={o.status} />
                          </div>
                        </div>
                      </div>
                      <div className="w-full flex justify-between md:block">
                          <span className="md:hidden text-xs text-slate-500 font-bold uppercase mt-1">A enviar:</span>
                          <div className="text-right md:text-left">
                            <p className="font-black text-white text-lg">{Number(o.amountFiat || o.amount || 0).toLocaleString()} {o.currencyId || 'VES'}</p>
                            {(o.amountUsdt || o.quantity) && (
                               <p className="text-sm text-emerald-400 font-bold mt-1">~ {Number(o.amountUsdt || o.quantity).toFixed(2)} {o.tokenId || 'USDT'}</p>
                            )}
                          </div>
                      </div>
                      <div className="w-full flex justify-end md:justify-end gap-2 text-xs">
                         <button 
                             onClick={() => handleViewPaymentDetails(o)}
                             className="flex-1 md:flex-none justify-center bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded shadow transition-all flex items-center gap-2"
                         >
                            <Eye className="w-4 h-4"/> Ver Detalle
                         </button>
                         <button 
                             onClick={() => handleReleaseOrder((o.bybitOrderId || o.binanceOrderId))}
                             className="flex-1 md:flex-none justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded shadow transition-all"
                         >
                            Liberar Orden
                         </button>
                      </div>
                    </div>
                ))}
              </div>
            </div>
         </div>
      )}

      {filteredAssignedOrders.filter((o: any) => ['PAGO RECIBIDO', 'DISTRIBUYENDO'].includes(o.status)).length > 0 && (
         <div className="bg-slate-900/80 backdrop-blur-xl border border-indigo-500/30 rounded-2xl overflow-hidden shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)] relative">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
                <h2 className="font-bold text-indigo-400 text-lg flex items-center gap-2">
                   <CheckCircle className="w-5 h-5"/> Pendientes por Liberar
                </h2>
                <span className="text-xs text-indigo-300">Pagos informados. Esperando contraparte.</span>
            </div>
            <div className="w-full flex flex-col text-sm text-left text-indigo-200">
              <div className="hidden md:grid md:grid-cols-3 text-xs text-indigo-300 uppercase bg-slate-950/80 px-6 py-4">
                 <div>Órdenes</div>
                 <div>Monto Pagado</div>
                 <div className="text-right">Estado</div>
              </div>
              <div className="flex flex-col divide-y divide-white/5">
                {filteredAssignedOrders.filter((o: any) => ['PAGO RECIBIDO', 'DISTRIBUYENDO'].includes(o.status)).map((o: any) => (
                    <div key={(o.bybitOrderId || o.binanceOrderId)} className="flex flex-col md:grid md:grid-cols-3 px-5 py-5 md:px-6 md:py-5 hover:bg-slate-800/50 transition-colors gap-4 md:gap-0 items-start md:items-center">
                      <div className="font-mono text-xs text-slate-400 w-full">
                          {(o.bybitOrderId || o.binanceOrderId)}
                          <br className="hidden md:block" />
                          <div className="flex flex-wrap gap-1 mt-1">
                            {o.exchange === 'binance' ? (
                              <span className="text-yellow-400 font-bold tracking-widest text-[10px] uppercase bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded">Binance</span>
                            ) : (
                              <span className="text-amber-400 font-bold tracking-widest text-[10px] uppercase bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">Bybit</span>
                            )}
                            {(o.side === 'BUY' || o.retailName?.includes('[COMPRA]')) && <span className="text-emerald-400 font-bold tracking-widest text-[10px] uppercase bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">🔵 COMPRA</span>}
                            {(o.side === 'SELL' || o.retailName?.includes('[VENTA]')) && <span className="text-rose-400 font-bold tracking-widest text-[10px] uppercase bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">🔴 VENTA</span>}
                          </div>
                      </div>
                      <div className="w-full flex justify-between md:block">
                          <span className="md:hidden text-xs text-slate-500 font-bold uppercase mt-1">Pagado:</span>
                          <div className="text-right md:text-left">
                            <p className="font-bold text-white md:text-indigo-200">{Number(o.amountFiat || o.amount || 0).toLocaleString()} {o.currencyId || 'VES'}</p>
                            {(o.amountUsdt || o.quantity) && (
                               <p className="text-sm text-emerald-400 font-bold mt-1">~ {Number(o.amountUsdt || o.quantity).toFixed(2)} {o.tokenId || 'USDT'}</p>
                            )}
                          </div>
                      </div>
                      <div className="w-full text-right font-mono text-indigo-400 text-sm mt-1 md:mt-0">
                         En Espera de Cripto
                      </div>
                    </div>
                ))}
              </div>
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

          <div className="w-full flex flex-col text-sm text-left text-slate-300">
            <div className="hidden md:grid md:grid-cols-4 text-xs text-slate-400 uppercase bg-slate-950/80 px-6 py-4">
               <div>Órdenes</div>
               <div>Monto Fiat a Enviar</div>
               <div>Recompensa (Cripto)</div>
               <div className="text-right">Acción</div>
            </div>
            <div className="flex flex-col divide-y divide-white/5">
              {filteredOrders.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-500 w-full flex flex-col items-center justify-center">
                   <RefreshCw className="w-8 h-8 text-slate-600 animate-spin-slow mb-3" />
                   <p>Buscando órdenes nuevas de {activeBankTab} en la Agencia...</p>
                </div>
              ) : (
                filteredOrders.map((o: any) => (
                  <div key={(o.bybitOrderId || o.binanceOrderId)} className="flex flex-col md:grid md:grid-cols-4 px-5 py-5 md:px-6 md:py-5 hover:bg-slate-800/50 transition-colors group gap-4 md:gap-0 items-start md:items-center">
                    <div className="font-mono text-xs text-slate-400 w-full">
                        <div className="flex justify-between items-start md:block">
                          <div>
                            {(o.bybitOrderId || o.binanceOrderId)}
                            <br className="hidden md:block" />
                            <div className="flex flex-wrap gap-1 mt-1">
                              {o.exchange === 'binance' ? (
                                <span className="text-yellow-400 font-bold tracking-widest text-[10px] uppercase bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded">Binance</span>
                              ) : (
                                <span className="text-amber-400 font-bold tracking-widest text-[10px] uppercase bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">Bybit</span>
                              )}
                              {(o.side === 'BUY' || o.retailName?.includes('[COMPRA]')) && <span className="text-emerald-400 font-bold tracking-widest text-[10px] uppercase bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">🔵 COMPRA</span>}
                              {(o.side === 'SELL' || o.retailName?.includes('[VENTA]')) && <span className="text-rose-400 font-bold tracking-widest text-[10px] uppercase bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">🔴 VENTA</span>}
                            </div>
                          </div>
                          <div className="md:mt-1 text-right md:text-left">
                            <P2pCountdown createdAt={o.createdAt || o.updatedAt} status={o.status} />
                          </div>
                        </div>
                        {o.assignedUser && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-400 font-bold px-2 py-1 bg-indigo-500/10 rounded border border-indigo-500/20 w-fit">
                                <span>T/ {o.assignedUser.alias}</span>
                            </div>
                        )}
                    </div>
                    <div className="w-full flex justify-between md:block items-center">
                        <span className="md:hidden text-xs text-slate-500 font-bold uppercase">A enviar:</span>
                        <div className="text-right md:text-left">
                          <p className="font-black text-white text-lg">{Number(o.amountFiat || o.amount || 0).toLocaleString()} {o.currencyId || 'VES'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Vía {o.paymentMethod || o.bankDetails || activeBankTab}</p>
                        </div>
                    </div>
                    <div className="w-full flex justify-between md:block items-center">
                        <span className="md:hidden text-xs text-slate-500 font-bold uppercase">Recompensa:</span>
                        <p className="font-black text-emerald-400 text-lg md:text-left text-right">+{(Number(o.quantity || 0)).toFixed(2)} {o.tokenId || 'USDT'}</p>
                    </div>
                    <div className="w-full text-right md:text-right mt-2 md:mt-0 flex justify-end">
                       {o.assignedUser ? (
                            <span className="text-slate-500 text-xs font-bold uppercase bg-slate-800 px-3 py-1.5 rounded border border-slate-700 w-full md:w-auto text-center">Asignada</span>
                       ) : (
                           <button 
                               onClick={() => handleTakeOrder((o.bybitOrderId || o.binanceOrderId))}
                               className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 md:py-2 px-6 rounded-lg shadow-[0_0_15px_-3px_rgba(99,102,241,0.5)] transition-all group-hover:scale-105 active:scale-95 w-full md:w-auto"
                           >
                              Tomar Orden
                           </button>
                       )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
      </div>

      {selectedOrderDetails && (
         <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
            <div className="w-full md:w-[450px] bg-slate-950 border-l border-slate-800 p-6 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] h-full animate-in slide-in-from-right duration-300">
               
               
               <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Users className="text-xs font-mono text-slate-500 mt-1" /> "Detalle Biográfico"
                    </h3>
                    <p className="text-xs font-mono text-slate-500 mt-1">{`Order #${(selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId)}`}</p>
                 </div>
                 <button 
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                    onClick={() => setSelectedOrderDetails(null)}
                  >
                    ✖
                 </button>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-6 hide-scrollbar">
                 <div className="bg-indigo-950/20 p-5 rounded-2xl border border-indigo-500/20 hover:border-indigo-500/40 transition-colors">
                   <h4 className="font-bold text-indigo-400 mb-3 flex items-center gap-2">
                     <Layers className="w-4 h-4" /> KYC del Maker/Taker
                   </h4>
                   {loadingDetails ? (
                     <div className="animate-pulse flex space-x-4">
                       <div className="flex-1 space-y-3 py-1">
                         <div className="h-2 bg-slate-800 rounded"></div>
                         <div className="space-y-2">
                           <div className="h-2 bg-slate-800 rounded w-5/6"></div>
                         </div>
                       </div>
                     </div>
                   ) : selectedOrderDetails.counterparty?.result ? (
                     <div className="space-y-4">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 mb-4">
                           <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nombre Registrado (ByBit KYC)</p>
                           <p className="font-bold text-white text-lg">
                             {selectedOrderDetails.counterparty.result.buyerRealName || selectedOrderDetails.counterparty.result.sellerRealName || 'IDENTIDAD OCULTA'}
                           </p>
                        </div>
                        {/* Datos de identidad / bancarios del comprador */}
                        {(() => {
                          const r = selectedOrderDetails.counterparty.result;
                          const isBinance = selectedOrderDetails.exchange === 'binance';
                          // Para Binance: identidad = cedula del chat o del order detail
                          const cedula  = r?.chatDetectedCedula || r?.identityNo || null;
                          const cuenta  = r?.chatDetectedAccount || null;
                          const titular = r?.accountHolder || r?.buyerRealName || null;
                          const hasData = !!(cedula || cuenta || r?.identityNo);

                          return (
                            <>
                              {hasData && (
                                <>
                                  {cedula && (
                                    <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded-xl flex justify-between items-center shadow-inner mb-2">
                                      <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Documento ID</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-white font-mono text-lg">{cedula}</span>
                                        <button onClick={() => navigator.clipboard.writeText(cedula)} className="text-slate-400 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button>
                                      </div>
                                    </div>
                                  )}
                                  {titular && (
                                    <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded-xl flex justify-between items-center shadow-inner mb-2">
                                      <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Titular</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-white font-mono text-sm">{titular}</span>
                                        <button onClick={() => navigator.clipboard.writeText(titular)} className="text-slate-400 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button>
                                      </div>
                                    </div>
                                  )}
                                  {cuenta && (
                                    <div className="bg-slate-800/80 border border-slate-700/50 p-3 rounded-xl flex justify-between items-center shadow-inner mb-4">
                                      <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">CUENTA CHAT</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-white font-mono text-lg">{cuenta}</span>
                                        <button onClick={() => navigator.clipboard.writeText(cuenta)} className="text-slate-400 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                              
                              <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-center mb-4 mt-2">
                                <p className="text-xs text-rose-400 font-bold mb-1">Solicitar / Corregir Datos en Chat</p>
                                <button
                                  onClick={() => handleRequestCI((selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId))}
                                  disabled={requestingCI}
                                  className="w-full bg-rose-500 hover:bg-rose-400 text-white py-2 rounded text-xs font-bold transition-all disabled:opacity-50 shadow-md flex justify-center items-center gap-2"
                                >
                                  {requestingCI ? 'Enviando Mensaje...' : 'Pedir Datos Auto por Chat'}
                                </button>
                              </div>
                            </>
                          );
                        })()}
                        {/* Binance: si no hay datos aún, botón de recarga */}
                        {selectedOrderDetails.exchange === 'binance' && !selectedOrderDetails.counterparty.result.chatDetectedAccount && (
                          <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-xl mb-3">
                            <p className="text-amber-400 text-xs font-bold mb-1 flex items-center gap-1">
                              🔄 Cargando datos bancarios...
                            </p>
                            <p className="text-[10px] text-slate-500 mb-2">
                              Obteniendo datos de pago desde Binance API (payMethods.fields)
                            </p>
                            <button
                              onClick={() => refreshChatData((selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId), 'binance')}
                              className="w-full bg-amber-600/80 hover:bg-amber-500 text-white py-1.5 rounded-lg text-xs font-bold transition-all"
                            >
                              🔄 Recargar Datos de Pago
                            </button>
                          </div>
                        )}
                        {selectedOrderDetails.counterparty.result.paymentTermList?.length > 0 ? (
                           selectedOrderDetails.counterparty.result.paymentTermList.map((p: any, idx: number) => (
                            <div key={idx} className="bg-slate-900 p-4 rounded-xl border-l-[3px] border-l-emerald-500 border border-slate-800 shadow-inner">
                               <p className="text-emerald-400 font-bold mb-2 flex justify-between">
                                  {p.paymentType || p.bankName}
                                  <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">Activa</span>
                               </p>
                               <div className="space-y-3 text-sm font-mono tracking-tight text-slate-300">
                                 <p className="flex justify-between items-center group">
                                    <span className="text-slate-500">CTA:</span> 
                                    {(() => {
                                      const textFields = [p.paymentText1, p.paymentText2, p.paymentText3, p.paymentText4, p.paymentText5];
                                      const bybitAccountFallback = textFields.find(t => t && /^\d{20}$/.test(String(t).replace(/[\s\-\.]/g, ''))) || '';
                                      const displayedAccount = p.accountNo || selectedOrderDetails.counterparty?.result?.chatDetectedAccount || bybitAccountFallback || '—';
                                      return (
                                        <span className="flex items-center gap-2">{displayedAccount} <button onClick={() => navigator.clipboard.writeText(displayedAccount)} className="text-slate-500 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button></span>
                                      );
                                    })()}
                                 </p>
                                 <p className="flex justify-between items-center group">
                                    <span className="text-slate-500">TITULAR:</span> 
                                    <span className="flex items-center gap-2">{p.realName} <button onClick={() => navigator.clipboard.writeText(p.realName)} className="text-slate-500 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button></span>
                                 </p>
                                 {Object.entries(p).map(([k, v]) => {
                                    if (typeof v !== 'string' || !v || ['accountNo', 'realName', 'paymentType', 'paymentId', 'id', 'online'].includes(k)) return null;
                                    let label = k;
                                    if (k === 'bankName') label = 'Banco Destino';
                                    if (k.toLowerCase().startsWith('paymenttext')) label = 'Personal ID number';
                                    return (
                                       <p key={k} className="flex justify-between items-center group">
                                          <span className="text-slate-500 uppercase">{label}:</span> 
                                          <span className="flex items-center gap-2">{v as string} <button onClick={() => navigator.clipboard.writeText(v as string)} className="text-slate-500 hover:text-white transition-colors"><Copy className="w-4 h-4"/></button></span>
                                       </p>
                                    );
                                 })}
                               </div>
                            </div>
                           ))
                        ) : (
                           <div className="text-sm p-4 bg-yellow-950/20 text-yellow-500 rounded-xl border border-yellow-900/30 text-center">
                              No hay rieles bancarios expuestos para esta orden.
                           </div>
                        )}

                        {/* Cuadro "Datos de Pago en Chat" — siempre visible si hay datos detectados */}
                        {(selectedOrderDetails.counterparty.result.chatDetectedAccount || selectedOrderDetails.counterparty.result.chatDetectedCedula) && (
                           <div className="bg-slate-900 p-4 rounded-xl border-l-[3px] border-l-cyan-500 border border-slate-800 shadow-inner mt-2">
                             <p className="text-cyan-400 font-bold mb-3 flex justify-between items-center text-sm">
                               <span>💬 Datos de Pago en Chat</span>
                               <span className="text-xs bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded-full animate-pulse">En vivo</span>
                             </p>
                             <div className="space-y-3 text-sm font-mono">
                               {selectedOrderDetails.counterparty.result.chatDetectedAccount && (
                                 <p className="flex justify-between items-center">
                                   <span className="text-slate-500">CUENTA/TELF:</span>
                                   <span className="flex items-center gap-2 text-white">
                                     {selectedOrderDetails.counterparty.result.chatDetectedAccount}
                                     <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.counterparty.result.chatDetectedAccount)} className="text-slate-500 hover:text-cyan-400 transition-colors"><Copy className="w-4 h-4"/></button>
                                   </span>
                                 </p>
                               )}
                               {selectedOrderDetails.counterparty.result.chatDetectedCedula && (
                                 <p className="flex justify-between items-center">
                                   <span className="text-slate-500">CÉDULA:</span>
                                   <span className="flex items-center gap-2 text-white">
                                     {selectedOrderDetails.counterparty.result.chatDetectedCedula}
                                     <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.counterparty.result.chatDetectedCedula)} className="text-slate-500 hover:text-cyan-400 transition-colors"><Copy className="w-4 h-4"/></button>
                                   </span>
                                 </p>
                               )}
                               {selectedOrderDetails.counterparty.result.chatDetectedBank && (
                                 <p className="flex justify-between items-center">
                                   <span className="text-slate-500">BANCO:</span>
                                   <span className="flex items-center gap-2 text-white">
                                     {selectedOrderDetails.counterparty.result.chatDetectedBank}
                                     <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.counterparty.result.chatDetectedBank)} className="text-slate-500 hover:text-cyan-400 transition-colors"><Copy className="w-4 h-4"/></button>
                                   </span>
                                 </p>
                               )}
                               <button
                                 onClick={() => {
                                   const amount = selectedOrderDetails.amountFiat
                                     ? Number(selectedOrderDetails.amountFiat).toFixed(2).replace('.', ',')
                                     : '';
                                   const parts = [
                                     amount,
                                     selectedOrderDetails.counterparty.result.chatDetectedAccount,
                                     selectedOrderDetails.counterparty.result.chatDetectedCedula,
                                     selectedOrderDetails.counterparty.result.chatDetectedBank,
                                   ].filter(Boolean).join('\n');
                                   navigator.clipboard.writeText(parts);
                                   console.log('✅ Datos del chat copiados');
                                 }}
                                 className="w-full mt-1 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-all"
                               >
                                 <Copy className="w-3 h-3"/> Copiar Datos del Chat
                               </button>
                             </div>
                           </div>
                         )}
                        
                        {/* Botón Copiar Todo de un click */}
                        {(() => {
                           const cp = selectedOrderDetails.counterparty?.result;
                           const term = cp?.paymentTermList?.[0];
                           const textFields = [term?.paymentText1, term?.paymentText2, term?.paymentText3, term?.paymentText4, term?.paymentText5];
                           const bybitAccountFallback = textFields.find(t => t && /^\d{20}$/.test(String(t).replace(/[\s\-\.]/g, ''))) || '';
                           const cuenta = term?.accountNo || cp?.chatDetectedAccount || bybitAccountFallback || '';
                           const bybitPersonalId = textFields.find(t => t && /^\d+$/.test(String(t).replace(/\D/g, ''))) || textFields.find(Boolean) || '';
                           const cedula = cp?.chatDetectedCedula || bybitPersonalId || cp?.identityNo || '';
                           const montoRaw = selectedOrderDetails.amountFiat || '';
                           const monto = montoRaw ? Number(montoRaw).toFixed(2).replace('.', ',') : '';
                           if (!cuenta && !cedula) return null;
                           const copyText = [monto, cuenta, cedula].filter(Boolean).join('\n');
                           return (
                             <button
                               onClick={() => {
                                 navigator.clipboard.writeText(copyText);
                                 console.log('✅ Datos copiados: Monto + Cuenta + Cédula');
                               }}
                               className="w-full mb-4 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                             >
                               <Copy className="w-4 h-4"/> Copiar Todo (Monto + Cuenta + Cédula)
                             </button>
                           );
                         })()}

                        <div className="bg-slate-900 border-l border-slate-700/50 p-6 flex flex-col pt-12">
                          <h3 className="text-xl font-bold text-white mb-2 pb-2 border-b border-slate-700">Detalles de la Contraparte</h3>
                          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg mb-4 flex flex-col items-center">
                              <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Total a Transferir</span>
                              <div className="flex items-center gap-2">
                                 <span className="text-white font-black text-2xl">{Number(selectedOrderDetails.amountFiat).toLocaleString()} {selectedOrderDetails.currencyId || 'VES'}</span>
                                 <button onClick={() => navigator.clipboard.writeText(Number(selectedOrderDetails.amountFiat).toFixed(2).replace('.', ','))} className="text-emerald-500/50 hover:text-emerald-400 transition-colors">
                                    <Copy className="w-5 h-5"/>
                                 </button>
                              </div>
                          </div>
                          <div className="bg-slate-950 border border-slate-700 rounded-xl p-5 mt-4">
                              <p className="text-xs text-slate-400 mb-4">Sube un comprobante. El bot lo enviará automáticamente al chat antes de soltar la orden a Bybit.</p>
                              
                              <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={handleFileChange}
                                  className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 mb-4 cursor-pointer"
                              />
                              
                              {receiptImageBase64 && (
                                  <div className="mb-4 rounded-lg overflow-hidden border border-indigo-500/30 max-h-48 relative">
                                      <img src={receiptImageBase64} alt="Preview" className="w-full object-cover" />
                                  </div>
                              )}
                              
                              <div className="flex gap-3 mt-4">
                                  <button
                                      onClick={() => handleMarkAsPaid((selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId) || selectedOrderDetails.orderId)}
                                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-3 rounded-lg text-sm font-bold transition-all shadow-md"
                                  >
                                      Pagar Sin Adjunto
                                  </button>
                                  <button
                                      onClick={() => handleMarkAsPaidWithReceipt((selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId) || selectedOrderDetails.orderId)}
                                      disabled={isSendingReceipt || !receiptImageBase64}
                                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 py-3 rounded-lg text-sm font-bold transition-all shadow-md flex justify-center items-center gap-2"
                                  >
                                      {isSendingReceipt ? 'Informando...' : 'Informar + Adjunto'}
                                  </button>
                              </div>
                          </div>
                        </div>

                        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
                           <h4 className="font-bold text-emerald-400 mb-3 flex items-center gap-2 text-sm">
                             <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                             </span>
                             Chat con Contraparte
                           </h4>
                           <textarea
                             value={chatMessage}
                             onChange={(e) => setChatMessage(e.target.value)}
                             className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all mb-4 resize-none shadow-inner font-mono max-h-32"
                             rows={3}
                             placeholder="> Escribir mensaje en el chat..."
                           ></textarea>
                           <button
                             onClick={handleSendChat}
                             disabled={isSendingChat || !chatMessage.trim()}
                             className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-all font-mono tracking-wider shadow-[0_0_15px_rgba(5,150,105,0.3)] hover:shadow-[0_0_20px_rgba(5,150,105,0.5)] flex justify-center items-center gap-2"
                           >
                             {isSendingChat ? (
                                <>
                                   <RefreshCw className="w-4 h-4 animate-spin"/> Enviando...
                                </>
                             ) : 'ENVIAR MENSAJE'}
                           </button>
                         </div>

                      </div>
                   ) : (
                      <p className="text-rose-400 text-sm">No se encontraron métodos de pago o hubo un error al leer la API de ByBit.</p>
                   )}
                 </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
