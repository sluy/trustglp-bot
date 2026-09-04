'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertOctagon, Link2, Users, RefreshCw, Layers, Radar, Copy } from 'lucide-react';
import io from 'socket.io-client';
import { isFrankTheme, isRafaTheme, isJarvisTheme } from '../../../lib/theme';
import { IS_DEMO } from '../../../lib/demoMode';
import { demoOrders, demoMarketData, demoAdUpdates } from '../../../lib/demoData';

const P2pCountdown = ({ createdAt, status }: { createdAt: string, status: string }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);

  // Status que significan "orden terminada" o "ya pagada" — sin countdown
  // Bybit: '20'=buyer paid, '30'=completada, '40'=cancelada
  // Binance: 'BUYER_PAYED','DISTRIBUTING','COMPLETED','CANCELLED'
  const isTerminal = ['20', '30', '40', '60', 'BUYER_PAYED', 'DISTRIBUTING', 'COMPLETED', 'CANCELLED', 'PAYMENT_SENT'].includes(status);

  useEffect(() => {
    if (isTerminal) {
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

  if (isTerminal) return null;

  return (
    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded border w-fit ${isExpired ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' : isFrankTheme ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : isRafaTheme ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
       <span>⏱ {timeLeft}</span>
    </div>
  );
};


export default function Dashboard() {
  const [systemActive, setSystemActive] = useState(true);
  const [orders, setOrders] = useState<any[]>([]); // Se pobla desde cache en useEffect
  const [stats, setStats] = useState({ pending: 0, completed: 0, volume: 0, bybit: 0, binance: 0 });
  const [activeBankTab, setActiveBankTab] = useState<string>('General');
  const [activeOperatorsCount, setActiveOperatorsCount] = useState<number>(0);
  const [exchangeFilter, setExchangeFilter] = useState<'all' | 'bybit' | 'binance'>('all');
  const [binanceError, setBinanceError] = useState<string | null>(null);

  // Cargar conteo real de operadores (backend + localStorage)
  useEffect(() => {
    const countFromStorage = () => {
      try {
        const localOps: any[] = JSON.parse(localStorage.getItem('telecambios_ve_local_operators') || '[]');
        return localOps.filter(o => o.status === 'ACTIVE').length;
      } catch { return 0; }
    };

    const ORDER_MANAGER = process.env.NEXT_PUBLIC_API_URL || '';
    if (ORDER_MANAGER) {
      fetch(`${ORDER_MANAGER}/community-users?role=operator`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const backendCount = d
            ? (Array.isArray(d) ? d : d.users || []).filter((o: any) => o.status === 'ACTIVE').length
            : 0;
          // Combinar backend + localStorage (sin duplicar por alias)
          let total = backendCount;
          try {
            const localOps: any[] = JSON.parse(localStorage.getItem('telecambios_ve_local_operators') || '[]');
            const backendList: any[] = d ? (Array.isArray(d) ? d : d.users || []) : [];
            const extraFromLocal = localOps.filter(lo =>
              lo.status === 'ACTIVE' && !backendList.find((b: any) => b.alias === lo.alias)
            ).length;
            total = backendCount + extraFromLocal;
          } catch {}
          setActiveOperatorsCount(total || countFromStorage());
        })
        .catch(() => setActiveOperatorsCount(countFromStorage()));
    } else {
      setActiveOperatorsCount(countFromStorage());
    }
  }, []);

  // Bancos activos — leídos directamente de telecambios_ve_payment_methods (localStorage del Config)
  const [activeBanks, setActiveBanks] = useState<{ id: string; label: string; emoji: string }[]>([
    { id: 'Banesco', label: 'Banesco', emoji: '🏦' },
  ]);

  useEffect(() => {
    // Cargar órdenes desde cache para carga instantánea (evita 5s en blanco)
    try {
      const cached = localStorage.getItem('p2p_orders_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setOrders(parsed);
      }
    } catch {}

    // Cargar bancos activos desde telecambios_ve_payment_methods (misma fuente que Config → Métodos P2P)
    const BANK_ID_MAP: Record<string, { label: string; emoji: string; tabId: string }> = {
      banesco:      { label: 'Banesco',    emoji: '🏦', tabId: 'Banesco'   },
      mercantil:    { label: 'Mercantil',  emoji: '🏦', tabId: 'Mercantil' },
      pagomovil:    { label: 'Pago Móvil', emoji: '📱', tabId: 'PagoMovil' },
      provincial:   { label: 'Provincial', emoji: '🏦', tabId: 'Provincial'},
      venezuela:    { label: 'BdV',        emoji: '🏦', tabId: 'BdV'      },
      bod:          { label: 'BOD',        emoji: '🏦', tabId: 'BOD'      },
      banplus:      { label: 'Banplus',    emoji: '🏦', tabId: 'Banplus'  },
      bnc:          { label: 'BNC',        emoji: '🏦', tabId: 'BNC'      },
      bicentenario: { label: 'Bicentenario', emoji: '🏦', tabId: 'Bicentenario' },
      sofitasa:     { label: 'Sofitasa',   emoji: '🏦', tabId: 'Sofitasa' },
      zelle:        { label: 'Zelle',      emoji: '💳', tabId: 'Zelle'    },
    };
    try {
      const savedPM = localStorage.getItem('telecambios_ve_payment_methods');
      if (savedPM) {
        const methods: any[] = JSON.parse(savedPM);
        const activeTabs = methods
          .filter((m: any) => m.enabled)
          .map((m: any) => {
            const mapped = BANK_ID_MAP[m.id];
            return mapped ? { id: mapped.tabId, label: mapped.label, emoji: mapped.emoji } : null;
          })
          .filter(Boolean) as { id: string; label: string; emoji: string }[];
        if (activeTabs.length > 0) {
          setActiveBanks(activeTabs);
          setActiveBankTab(activeTabs[0].id);
        }
      }
    } catch {}
  }, []);

  const [capitalUsdt, setCapitalUsdt] = useState<number>(500);
  const [vitalSpreadPct, setVitalSpreadPct] = useState<number>(1.0);
  const [isUpdatingCapital, setIsUpdatingCapital] = useState(false);
  // selectedStrategy / activeStrategy states kept for future radar module
  const [selectedStrategyRegistry, setSelectedStrategyRegistry] = useState<Record<string, any>>({});
  const selectedStrategy = selectedStrategyRegistry[activeBankTab];
  const [activeStrategyRegistry, setActiveStrategyRegistry] = useState<Record<string, any>>({});
  const activeStrategy = activeStrategyRegistry[activeBankTab];
  const [isActivating, setIsActivating] = useState(false);
  const [marketDataRegistry, setMarketDataRegistry] = useState<Record<string, any>>({});
  const marketData = marketDataRegistry[activeBankTab];

  // Estado para el monitor de anuncios (ADS_MONITOR)
  const [adUpdates, setAdUpdates] = useState<Record<string, { adType: 'SELL'|'BUY', price: string, exchange: string, bank: string, success: boolean, timestamp: string }>>({});
  const [lastScannerPing, setLastScannerPing] = useState<number | null>(null);
  const [lastPricingPing, setLastPricingPing] = useState<number | null>(null);
  const [systemHealth, setSystemHealth] = useState<{
    binance: { status: 'ok'|'api_error'|'offline'; message: string } | null;
    bybit:   { status: 'ok'|'api_error'|'offline'; message: string } | null;
  }>({ binance: null, bybit: null });

  // Estados visuales P2P Contraparte + Chat
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  const [isCounterpartyLoading, setIsCounterpartyLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [requestingCI, setRequestingCI] = useState(false);
  const [receiptImageBase64, setReceiptImageBase64] = useState<string | null>(null);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  // Binance: pegado manual de datos del chat (Binance no tiene API pública de chat)
  const [binanceChatPaste, setBinanceChatPaste] = useState('');

  // receiptFile guarda el File original para subirlo via FormData (evita límites del proxy con base64 JSON)
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const handleFileChange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      setReceiptFile(file);
      // Preview local: comprimir a 800px, 60% para la vista previa
      const reader = new FileReader();
      reader.onload = (event: any) => {
          const img = new Image();
          img.onload = () => {
              // Preview: 800px
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800;
              let scaleSize = 1;
              if (img.width > MAX_WIDTH) scaleSize = MAX_WIDTH / img.width;
              canvas.width = img.width * scaleSize;
              canvas.height = img.height * scaleSize;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              setReceiptImageBase64(canvas.toDataURL('image/jpeg', 0.6));
          };
          img.src = event.target.result;
      };
      reader.readAsDataURL(file);
  };

  useEffect(() => {
    // ── Demo Mode: simulate socket with static data ──
    if (IS_DEMO) {
      setLastScannerPing(Date.now());
      setLastPricingPing(Date.now());
      setMarketDataRegistry(demoMarketData);
      setAdUpdates(demoAdUpdates);
      // Simulate periodic scanner ping
      const demoInterval = setInterval(() => {
        setLastScannerPing(Date.now());
        setLastPricingPing(Date.now());
      }, 5000);
      return () => clearInterval(demoInterval);
    }

    // Escuchar el socket de Bybit
    const WEBSOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('bybitMarketUpdate', (data) => {
      setLastScannerPing(Date.now());
      let bank = data.bank;
      if (!bank) {
         // Fallback por si el backend no ha sido actualizado
         const strategyId = data.top_strategies?.[0]?.strategy_id || '';
         if (strategyId.includes('mercantil')) {
            bank = 'Mercantil';
         } else if (strategyId.toLowerCase().includes('pagomovil')) {
            bank = 'PagoMovil';
         } else {
            bank = 'Banesco';
         }
      }
      setMarketDataRegistry(prev => ({
         ...prev,
         [bank]: data
      }));
    });

    socket.on('adUpdate', (data: any) => {
      setLastPricingPing(Date.now());
      setAdUpdates(prev => ({ ...prev, [data.adId]: data }));
    });

    socket.on('systemHealth', (data: any) => {
      setSystemHealth({ binance: data.binance, bybit: data.bybit });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      // ── Demo Mode: use static dummy data ──
      if (IS_DEMO) {
        setOrders(demoOrders);
        const bybitCount = demoOrders.filter(o => o.exchange === 'bybit').length;
        const binanceCount = demoOrders.filter(o => o.exchange === 'binance').length;
        const pending = demoOrders.filter(o => ['5','10','PENDING','TRADING','BUYER_PAYED','DISTRIBUTING'].includes(o.statusRaw)).length;
        const volume = demoOrders.reduce((a, o) => a + parseFloat(o.quantity || '0'), 0);
        setStats({ pending, completed: 0, volume: Math.round(volume * 100) / 100, bybit: bybitCount, binance: binanceCount });
        return;
      }

      try {
        // ── Fetch ambos exchanges en paralelo ──
        const [bybitRes, binanceRes] = await Promise.allSettled([
          fetch('/api/bybit/orders'),
          fetch('/api/binance/orders'),
        ]);

        const bybitOrders:   any[] = [];
        const binanceOrders: any[] = [];

        // Bybit
        if (bybitRes.status === 'fulfilled' && bybitRes.value.ok) {
          const data = await bybitRes.value.json();
          if (!data.error || data.orders?.length) {
            bybitOrders.push(...(data.orders || []));
          } else {
            console.warn('[Bybit Orders]', data.error);
          }
        }

        // Binance
        if (binanceRes.status === 'fulfilled' && binanceRes.value.ok) {
          const data = await binanceRes.value.json();
          if (!data.error || data.orders?.length) {
            binanceOrders.push(...(data.orders || []));
            setBinanceError(null);
          } else {
            console.warn('[Binance Orders]', data.error);
            setBinanceError(data.error || 'Error conectando con Binance');
          }
        }

        // Merge + ordenar por fecha más reciente
        const merged = [...bybitOrders, ...binanceOrders].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Fetch assignments y mergear
        try {
          const assignRes = await fetch('/api/orders/assignments');
          if (assignRes.ok) {
            const assignments = await assignRes.json();
            merged.forEach(o => {
              const oId = (o.bybitOrderId || o.binanceOrderId) || o.binanceOrderId;
              if (assignments[oId]) {
                o.assignedUser = { alias: assignments[oId].operatorName, operatorId: assignments[oId].operatorId };
              }
            });
          }
        } catch(e) {}

        setOrders(merged);
        // Guardar en cache para carga instantánea en próxima visita
        try { localStorage.setItem('p2p_orders_cache', JSON.stringify(merged)); } catch {}

        // 🤖 Ping al bot automatizado de Binance (sin bloquear)
        fetch('/api/binance/bot/run', { method: 'POST' }).catch(() => {});

        // Stats combinadas
        const bybitActive   = bybitOrders.filter((o: any) => ['5','10'].includes(o.statusRaw)).length;
        const binanceActive = binanceOrders.filter((o: any) => ['PENDING','TRADING','BUYER_PAYED','DISTRIBUTING'].includes(o.statusRaw)).length;
        const volume = merged.reduce((a: number, o: any) => a + parseFloat(o.quantity || '0'), 0);
        setStats({
          pending:  bybitActive + binanceActive,
          completed: 0,
          volume:   Math.round(volume * 100) / 100,
          bybit:    bybitOrders.length,
          binance:  binanceOrders.length,
        });
      } catch (e) {
        console.error('[Orders fetch]', e);
      }
    };

    fetchOrders();
    const int = setInterval(fetchOrders, IS_DEMO ? 60000 : 15000);

    // Refrescar inmediatamente al volver a la pestaña (sin pantalla en blanco)
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchOrders(); };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(int);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);


  const handleKillSwitch = () => {
    if (IS_DEMO) { alert('🎮 DEMO: El Kill Switch no está disponible en modo demo.'); return; }
    setSystemActive(false);
    alert('🚨 EMERGENCY KILLSWITCH ACTIVADO: Se han pausado los anuncios en ByBit.');
  };

  const handleUpdateConfig = async () => {
     if (IS_DEMO) { alert('🎮 DEMO: La configuración no se puede cambiar en modo demo.'); return; }
     setIsUpdatingCapital(true);
     try {
        const P2P_API = process.env.NEXT_PUBLIC_P2P_API_URL || 'http://localhost:4000/p2p-command';
        
        const resCap = await fetch(`${P2P_API}/operative-capital`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ target_usdt: capitalUsdt })
        });
        
        const resSpread = await fetch(`${P2P_API}/vital-spread`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ spread_pct: vitalSpreadPct })
        });

        if (resCap.ok && resSpread.ok) {
           console.log(`✅ Parámetros Algorítmicos Ajustados:\n- Caja Limit: ${capitalUsdt} USDT\n- Spread Min: ${vitalSpreadPct}%\n\nEl Scanner actualizará las posiciones en Bybit en el próximo ciclo.`);
        } else {
           alert('❌ Error sincronizando parámetros de configuración en el Gateway.');
        }
     } catch (e) {
        console.error(e);
        alert('❌ Error de conexión al Gateway NestJS P2P.');
     } finally {
        setIsUpdatingCapital(false);
     }
  };

  const handleActivateStrategy = async () => {
     if (!selectedStrategy) return;
     if (IS_DEMO) {
       setActiveStrategyRegistry(prev => ({ ...prev, [activeBankTab]: selectedStrategy }));
       alert(`🎮 DEMO: Estrategia "${selectedStrategy.label}" activada (simulación).`);
       return;
     }
     setIsActivating(true);
     try {
        const P2P_API = process.env.NEXT_PUBLIC_P2P_API_URL || 'http://localhost:4000/p2p-command';
        const res = await fetch(`${P2P_API}/active-strategy`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ ...selectedStrategy, bank: activeBankTab })
        });
        if (res.ok) {
           setActiveStrategyRegistry(prev => ({ ...prev, [activeBankTab]: selectedStrategy }));
           alert(`🚀 Estrategia Fijada para ${activeBankTab}! ByBit ahora auto-actualizará tus anuncios para mantener esta posición.`);
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


  // ── Polling en tiempo real del chat (actualiza datos detectados cada 10s) ──
  const chatPollRef = useRef<NodeJS.Timeout | null>(null);

  const refreshChatData = useCallback(async (orderId: string, exchangeType: string) => {
    try {
      if (exchangeType === 'binance') {
        // 1. Intentar obtener datos desde la orden directamente (payMethods.fields)
        const orderRes = await fetch(`/api/binance/order/${orderId}`, { cache: 'no-store' });
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          if (orderData.ok && (orderData.result?.chatDetectedAccount || orderData.result?.chatDetectedCedula)) {
            setSelectedOrderDetails((prev: any) => {
              if (!prev || prev.bybitOrderId !== orderId) return prev;
              return {
                ...prev,
                counterparty: {
                  ...prev.counterparty,
                  result: {
                    ...prev.counterparty?.result,
                    chatDetectedAccount: orderData.result.chatDetectedAccount || prev.counterparty?.result?.chatDetectedAccount,
                    chatDetectedCedula:  orderData.result.chatDetectedCedula  || prev.counterparty?.result?.chatDetectedCedula,
                    accountHolder:       orderData.result.accountHolder        || prev.counterparty?.result?.accountHolder,
                    payId:               orderData.result.payId                || prev.counterparty?.result?.payId,
                  }
                }
              };
            });
            // NO hacer return aquí, queremos leer el chat siempre por si hay datos actualizados
          }
        }

        // 2. Si no hay datos en la orden, o queremos sobreescribir con el chat, leer historial de chat vía REST
        const chatRes = await fetch(`/api/binance/order/${orderId}/chat`, { cache: 'no-store' });
        if (!chatRes.ok) return;
        const chatData = await chatRes.json();
        if (chatData.chatDetectedAccount || chatData.chatDetectedCedula) {
          setSelectedOrderDetails((prev: any) => {
            if (!prev || prev.bybitOrderId !== orderId) return prev;
            return {
              ...prev,
              counterparty: {
                ...prev.counterparty,
                result: {
                  ...prev.counterparty?.result,
                  chatOnlyAccount: chatData.chatDetectedAccount,
                  chatOnlyCedula:  chatData.chatDetectedCedula,
                  chatOnlyBank:    chatData.chatDetectedBank,
                }
              }
            };
          });
        }
      } else {
        // Bybit: endpoint existente con KYC + chat detection
        const res = await fetch(`/api/bybit/order/${orderId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setSelectedOrderDetails((prev: any) => {
          if (!prev || prev.bybitOrderId !== orderId) return prev;
          return { ...prev, counterparty: data };
        });
      }
    } catch (_) { /* no crítico */ }
  }, []);

  // Binance: parsear cuenta/cédula pegados manualmente desde el chat
  const handleBinanceChatParse = () => {
    const text = binanceChatPaste;
    if (!text.trim()) return;
    // Limpiar espacios/saltos de línea para buscar números
    const clean = text.replace(/\s+/g, '');
    // Cuenta venezolana: 20 dígitos empezando con 01 o 02 (sin \b que falla si va pegado a otra cifra)
    const accountMatch = clean.match(/(0[12]\d{18})/) || clean.match(/(\d{20})/);
    const account = accountMatch ? accountMatch[1] : null;
    // Cédula: 6-9 dígitos en el texto restante
    const textWithoutAccount = account ? clean.replace(account, '') : clean;
    const cedulaMatch = textWithoutAccount.match(/(\d{6,9})/);
    const cedula = cedulaMatch ? cedulaMatch[1] : null;
    if (!account && !cedula) {
      alert('⚠️ No se detectaron datos. Asegúrate de pegar el texto completo del chat (número de cuenta de 20 dígitos y/o cédula).');
      return;
    }
    setSelectedOrderDetails((prev: any) => ({
      ...prev,
      counterparty: {
        ...prev.counterparty,
        result: {
          ...prev.counterparty?.result,
          chatDetectedAccount: account || prev.counterparty?.result?.chatDetectedAccount,
          chatDetectedCedula:  cedula  || prev.counterparty?.result?.chatDetectedCedula,
        }
      }
    }));
    setBinanceChatPaste('');
    console.log(`✅ Detectado:\n${account ? '• Cuenta: ' + account : ''}
${cedula  ? '• Cédula: ' + cedula  : ''}`);
  };

  useEffect(() => {
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    if (selectedOrderDetails?.bybitOrderId) {
      const id = selectedOrderDetails.bybitOrderId;
      const ex = selectedOrderDetails.exchange || 'bybit';
      // Bybit: cada 10s | Binance: cada 5s (clipboard read es instantáneo)
      const interval = ex === 'binance' ? 5000 : 10000;
      // Primera lectura inmediata
      refreshChatData(id, ex);
      chatPollRef.current = setInterval(() => refreshChatData(id, ex), interval);
    }
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [selectedOrderDetails?.bybitOrderId, refreshChatData]);

  const handleOrderClick = async (o: any) => {
    setSelectedOrderDetails({ ...o, counterparty: null });
    setIsCounterpartyLoading(true);

    
    try {
      // Para órdenes de Bybit: usar nuestro endpoint Next.js (llama directo a Bybit API)
      // Para órdenes de Binance: usar endpoint Binance (a implementar)
      if (o.exchange === 'bybit') {
        const res = await fetch(`/api/bybit/order/${o.bybitOrderId}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedOrderDetails({ ...o, counterparty: data });
        } else {
          setSelectedOrderDetails({ ...o, counterparty: { result: null, error: 'Error al conectar con Bybit' } });
        }
      } else {
        // Binance: llamar al endpoint de detalle para obtener info de pago
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
        // Intentar obtener detalles de pago desde Binance API (async)
        try {
          const detailRes = await fetch(`/api/binance/order/${o.binanceOrderId}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            if (detail.ok && detail.result) {
              const dr = detail.result;
              setSelectedOrderDetails(prev => ({
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
       setIsCounterpartyLoading(false);
    }
  };
  
  const handleSendChat = async () => {
     if(!chatMessage.trim() || !selectedOrderDetails) return;
     setIsSendingChat(true);
     try {
        const isBinance = selectedOrderDetails.exchange === 'binance';
        const url = isBinance 
            ? `/api/binance/order/${selectedOrderDetails.binanceOrderId}/chat/send` 
            : `/api/bybit/order/${selectedOrderDetails.bybitOrderId}/chat`;
        
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

   const handleRequestCI = async (orderId: string) => {
       const exchange = selectedOrderDetails?.exchange || 'bybit';
       const msg = '¡Hola! Por medidas de seguridad y para poder emitir la transferencia a tu nombre, requerimos tu número de Cédula y tu Número de Cuenta bancaria de 20 dígitos. Por favor escríbelos por aquí para enviar el dinero inmediatamente. Gracias.';

       // Binance: enviar vía nuevo endpoint SAPI automatizado
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

       // Bybit: enviar vía API
       setRequestingCI(true);
       try {
          const res = await fetch(`/api/bybit/order/${orderId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_message', message: msg })
          });
          const data = await res.json();
          if (data.ok) {
              console.log('✅ Mensaje enviado al chat de Bybit. Espera la respuesta del comprador para que el sistema la detecte automáticamente.');
          } else {
              alert(`Error enviando mensaje: ${data.error}`);
          }
       } catch (e) {
          alert('Error conectando a la API de Chat Bybit.');
       } finally {
          setRequestingCI(false);
       }
    };

    const handleMarkAsPaid = async (orderId: string) => {
      const isBinance = selectedOrderDetails?.exchange === 'binance';
      if (!confirm(`¿Confirmas que pagaste manualmente? ${isBinance ? '(Marcará la orden en Binance P2P)' : '(Bybit)'}`)) return;
      try {
        if (isBinance) {
          // Binance: usar endpoint de mark-paid con payId
          const payId = selectedOrderDetails?.counterparty?.result?.payId || '';
          const res = await fetch(`/api/binance/order/${orderId}/mark-paid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payId }),
          });
          const data = await res.json();
          if (data.ok) {
            console.log('✅ Orden marcada como Pagada en Binance P2P.');
            setOrders((prev: any[]) => prev.filter((o: any) => o.bybitOrderId !== orderId));
            setSelectedOrderDetails(null);
          } else {
            alert(`❌ Error Binance: ${data.error}`);
          }
        } else {
          // Bybit: flujo original
          const res = await fetch(`/api/bybit/order/${orderId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_paid' })
          });
          const data = await res.json();
          if (data.ok) {
            console.log('Orden marcada como Pagada en Bybit.');
            setOrders((prev: any[]) => prev.filter((o: any) => o.bybitOrderId !== orderId));
            setSelectedOrderDetails(null);
          } else {
            alert(`Error: ${data.error}`);
          }
        }
      } catch(e) {
        alert('Error procesando el pago.');
      }
    };
  
    const handleMarkAsPaidWithReceipt = async (orderId: string) => {
       if (!receiptImageBase64) return alert("Sube el comprobante primero.");
       setIsSendingReceipt(true);
       const isBinance = selectedOrderDetails?.exchange === 'binance';

       try {
           if (isBinance) {
             // === BINANCE: subir imagen directamente al chat Binance via pre-signed URL ===
             // Convertir base64 a Blob para FormData
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
               alert(`❌ Error subiendo imagen a Binance: ${uploadData.error}`);
               return;
             }

             // Marcar como pagado
             const payId = selectedOrderDetails?.counterparty?.result?.payId || '';
             const paidRes = await fetch(`/api/binance/order/${orderId}/mark-paid`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ payId }),
             });
             const paidData = await paidRes.json();

             const lines = ['✅ Binance - Proceso ejecutado:'];
             lines.push(uploadData.ok ? '📎 Comprobante enviado al chat de Binance' : '⚠️ Imagen no enviada');
             lines.push(paidData.ok ? '✅ Orden marcada como Pagada' : `⚠️ Pago: ${paidData.error || 'no confirmado'}`);
             alert(lines.join('\n'));

             setReceiptImageBase64(null);
             setReceiptFile(null);
             setSelectedOrderDetails(null);
             setOrders((prev: any[]) => prev.filter((o: any) => o.bybitOrderId !== orderId));

           } else {
             // === BYBIT: flujo original ===
             // Comprimir a 400px/40% → ~20-50KB JSON
             const uploadB64 = await new Promise<string>((resolve) => {
               const img = new Image();
               img.onload = () => {
                 const c = document.createElement('canvas');
                 const s = img.width > 400 ? 400 / img.width : 1;
                 c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
                 c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
                 resolve(c.toDataURL('image/jpeg', 0.4));
               };
               img.src = receiptImageBase64!;
             });

             // Paso 1: Subir imagen como JSON
             let receiptUrl = '';
             try {
               const uploadRes = await fetch('/api/bybit/receipt/upload', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ imageBase64: uploadB64 }),
               });
               const uploadText = await uploadRes.text();
               let uploadData: any = {};
               try { uploadData = JSON.parse(uploadText); } catch { /* html response */ }
               if (uploadRes.ok && uploadData.ok) {
                 receiptUrl = uploadData.url;
               } else {
                 console.warn('[Upload] Falló:', uploadRes.status, uploadText.slice(0, 200));
               }
             } catch (uploadErr: any) {
               console.warn('[Upload] Error de red:', uploadErr.message);
             }

             // Paso 2: Enviar al chat + marcar pagado
             const chatRes = await fetch(`/api/bybit/order/${orderId}/chat`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ action: 'pay_with_receipt', receiptUrl: receiptUrl || '' })
             });
             const chatData = await chatRes.json();

             const lines = ['✅ Proceso ejecutado:'];
             lines.push(receiptUrl ? `📎 Comprobante guardado: ${receiptUrl}` : '⚠️ Imagen no subida (proxy)');
             lines.push(chatData.chatOk ? '💬 Chat: mensaje enviado' : `⚠️ Chat: ${chatData.notes?.split(' | ')[0] || 'no enviado'}`);
             lines.push(chatData.paidOk ? '✅ Pago: marcado como pagado' : `⚠️ Pago: ${chatData.notes?.split(' | ')[1] || chatData.notes || 'no confirmado'}`);
             alert(lines.join('\n'));

             setReceiptImageBase64(null);
             setReceiptFile(null);
             setSelectedOrderDetails(null);
             setOrders((prev: any[]) => prev.filter((o: any) => o.bybitOrderId !== orderId));
           }

       } catch (e: any) {
           console.error('[Receipt]', e);
           alert(`Error inesperado: ${e.message}`);
       } finally {
           setIsSendingReceipt(false);
       }
    };


  const filteredOrders = orders.filter((o: any) => {
      // Filtrar por exchange si hay filtro activo
      if (exchangeFilter === 'bybit'   && o.exchange !== 'bybit')   return false;
      if (exchangeFilter === 'binance' && o.exchange !== 'binance') return false;

      // General: mostrar TODAS las órdenes
      if (activeBankTab === 'General') return true;

      // Filtrar por método de pago
      const payMethod = (o.paymentMethod || o.bankDetails || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const retailNameNorm = (o.retailName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const combined = payMethod + ' ' + retailNameNorm;

      const isMercantil = combined.includes('mercantil');
      const isPagoMovil  = combined.includes('pago') || combined.includes('movil') || combined.includes('transferencia');
      const isBanesco    = combined.includes('banesco') || (!isMercantil && !isPagoMovil);

      if (activeBankTab === 'Mercantil') return isMercantil;
      if (activeBankTab === 'PagoMovil') return isPagoMovil;
      if (activeBankTab === 'Banesco')   return isBanesco;
      return true;
  });


  return (
    <div className="space-y-6">
      <header className={isFrankTheme ? "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 border-b border-orange-500/10 pb-4 relative" : isRafaTheme ? "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 border-b border-emerald-500/10 pb-4 relative" : "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 border-b border-slate-800 pb-4"}>
        {isFrankTheme && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-orange-500/30 via-transparent to-amber-500/30"></div>}
        {isRafaTheme && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-emerald-500/30 via-transparent to-teal-500/30"></div>}
        <div>
          <h1 className={isFrankTheme ? "text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2 sm:gap-3 bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-400" : isRafaTheme ? "text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2 sm:gap-3 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400" : "text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3"}>
            {'P2P Command Center'}
            <span className="relative flex h-3 w-3" title="Sistema Online">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isFrankTheme ? 'bg-orange-400' : isRafaTheme ? 'bg-emerald-400' : 'bg-emerald-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isFrankTheme ? 'bg-orange-500' : isRafaTheme ? 'bg-emerald-500' : 'bg-emerald-500'}`}></span>
            </span>
          </h1>
          {isFrankTheme || isRafaTheme
            ? <p className="text-slate-500 text-sm sm:text-base mt-1 font-mono">// <span className={isFrankTheme ? "text-orange-500/60" : "text-emerald-500/60"}>CONTROL_CENTRALIZADO</span> | <strong className="text-slate-400">Bybit + Binance Multi-Exchange</strong></p>
            : <p className="text-slate-400 text-sm sm:text-base mt-1">Control Centralizado OTC | <strong>Bybit + Binance Multi-Exchange</strong></p>
          }
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
           {systemActive ? (
             <span className={isFrankTheme ? "flex items-center justify-center w-full sm:w-auto gap-2 text-orange-400 font-semibold px-4 py-2 bg-orange-500/10 rounded-lg text-sm border border-orange-500/20" : "flex items-center justify-center w-full sm:w-auto gap-2 text-emerald-400 font-semibold px-4 py-2 bg-emerald-400/10 rounded-full text-sm"}>
               <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isFrankTheme ? 'bg-orange-400' : 'bg-emerald-400'} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isFrankTheme ? 'bg-orange-500' : 'bg-emerald-500'}`}></span>
               </span>
               Routing Operativo
             </span>
           ) : (
             <span className="flex items-center justify-center w-full sm:w-auto gap-2 text-red-500 font-bold px-4 py-2 bg-red-500/10 rounded-full border border-red-500 text-sm">
               <AlertOctagon className="w-4 h-4" /> BOT DETENIDO
             </span>
           )}
        </div>
      </header>

      {/* Stats Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={isFrankTheme ? "glow-card bg-[#020617] rounded-xl p-6 shadow-xl relative overflow-hidden" : isRafaTheme ? "glow-card-rafa bg-[#022c22] rounded-xl p-6 shadow-xl relative overflow-hidden" : "bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl"}>
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Layers className={`w-5 h-5 ${isFrankTheme ? 'text-orange-400' : 'text-indigo-400'}`} /> {isFrankTheme ? <span className="font-mono text-xs uppercase tracking-wider">Órdenes Pendientes</span> : 'Órdenes Pendientes'}
          </div>
          <p className={isFrankTheme ? "text-3xl font-black text-orange-400 font-mono" : "text-3xl font-black text-indigo-400"}>{stats.pending}</p>
        </div>
        <div className={isFrankTheme ? "glow-card bg-[#020617] rounded-xl p-6 shadow-xl relative overflow-hidden" : isRafaTheme ? "glow-card-rafa bg-[#022c22] rounded-xl p-6 shadow-xl relative overflow-hidden" : "bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl"}>
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <Users className={`w-5 h-5 ${isFrankTheme ? 'text-emerald-400' : 'text-purple-400'}`} /> {isFrankTheme ? <span className="font-mono text-xs uppercase tracking-wider">Red de Cajeros</span> : 'Red de Cajeros (Liquidez)'}
          </div>
          <p className="text-3xl font-bold">{activeOperatorsCount} <span className="text-sm font-normal text-slate-500">activos</span></p>
        </div>
        <div className={isFrankTheme ? "glow-card bg-[#020617] rounded-xl p-6 shadow-xl relative overflow-hidden" : isRafaTheme ? "glow-card-rafa bg-[#022c22] rounded-xl p-6 shadow-xl relative overflow-hidden" : "bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl"}>
          <div className="flex items-center gap-3 text-slate-400 mb-2">
            <RefreshCw className="w-5 h-5 text-emerald-400" /> {isFrankTheme ? <span className="font-mono text-xs uppercase tracking-wider">Volumen Liberado</span> : 'Volumen Circulante Liberado'}
          </div>
          <p className={`text-3xl font-black text-emerald-400 ${isFrankTheme ? 'font-mono' : ''}`}>{stats.volume.toLocaleString()} <span className="text-sm font-normal">USDT</span></p>
        </div>
      </div>

      {/* Exchange Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Exchange:</span>
        {(['all', 'bybit', 'binance'] as const).map((ex) => (
          <button
            key={ex}
            onClick={() => setExchangeFilter(ex)}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
              exchangeFilter === ex
                ? ex === 'bybit'   ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                  : ex === 'binance' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                : 'text-slate-500 border-slate-700/50 hover:text-slate-300'
            }`}
          >
            {ex === 'all' ? `🌐 Todos (${orders.length})` : ex === 'bybit' ? `🟠 ByBit (${stats.bybit})` : `🟡 Binance (${stats.binance})`}
          </button>
        ))}
        {binanceError && (
          <span className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-full font-mono">
            ⚠ Binance: {binanceError.slice(0, 60)}
          </span>
        )}
      </div>

      <div className={`flex flex-wrap gap-2 border-b ${isFrankTheme ? 'border-orange-500/10' : isRafaTheme ? 'border-emerald-500/10' : 'border-slate-800'} mb-6 pb-2`}>
        <button
          onClick={() => setActiveBankTab('General')}
          className={`px-5 py-2 font-bold text-sm rounded-lg transition-all ${
            activeBankTab === 'General'
              ? isFrankTheme ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                : isRafaTheme ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-indigo-600/20 text-indigo-400 border-b-2 border-indigo-400 rounded-none'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
        >
          🌐 General ({orders.filter((o: any) => exchangeFilter === 'all' || o.exchange === exchangeFilter).length})
        </button>
        {activeBanks.map((bank) => {
          const isActive = activeBankTab === bank.id;
          return (
            <button
              key={bank.id}
              onClick={() => setActiveBankTab(bank.id)}
              className={`px-5 py-2 font-bold text-sm rounded-lg transition-all ${
                isActive
                  ? isFrankTheme ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    : isRafaTheme ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-emerald-600/20 text-emerald-400 border-b-2 border-emerald-400 rounded-none'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              } ${isFrankTheme || isRafaTheme ? 'font-mono tracking-wider' : ''}`}
            >
              {bank.emoji} {isFrankTheme || isRafaTheme ? bank.label.toUpperCase().replace(' ', '_') : bank.label}
            </button>
          );
        })}
      </div>


        <div className={isFrankTheme ? "glow-card bg-[#020617] rounded-xl overflow-hidden mt-6" : isRafaTheme ? "glow-card-rafa bg-[#022c22] rounded-xl overflow-hidden mt-6" : "bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mt-6"}>
          <div className={isFrankTheme ? "px-6 py-4 border-b border-orange-500/10 flex justify-between items-center" : isRafaTheme ? "px-6 py-4 border-b border-emerald-500/10 flex justify-between items-center" : "px-6 py-4 border-b border-slate-800 flex justify-between items-center"}>
              <h2 className={isFrankTheme || isRafaTheme ? "font-black text-white flex items-center gap-2 font-mono" : "font-bold text-white flex items-center gap-2"}><Link2 className={`w-5 h-5 ${isFrankTheme ? 'text-orange-400' : isRafaTheme ? 'text-emerald-400' : ''}`}/> {isFrankTheme || isRafaTheme ? <>LIVE_QUEUE // <span className={isFrankTheme ? "text-orange-400/60" : "text-emerald-400/60"}>{activeBankTab.toUpperCase()}</span></> : `Live Marketplace Queue - ${activeBankTab}`}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className={isFrankTheme ? "text-xs text-orange-500/60 uppercase bg-[#020617] font-mono tracking-wider" : isRafaTheme ? "text-xs text-emerald-500/60 uppercase bg-[#022c22] font-mono tracking-wider" : "text-xs text-slate-400 uppercase bg-slate-900/50"}>
                <tr>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Orden ID</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Tipo</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Contraparte</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Fiat (VES)</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Cripto (USDT)</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Método Pago</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Tiempo</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                          <span className="text-2xl">📭</span>
                        </div>
                        <p className="text-slate-500 text-sm">No hay órdenes activas para {activeBankTab}</p>
                        <p className="text-slate-600 text-xs">Las nuevas órdenes aparecerán aquí automáticamente (refresco cada 15s)</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o: any) => {
                    // Bybit: statusRaw '10' = pendiente de pago (NO pagado), '20' = pago recibido
                    // Binance: statusRaw 'PENDING'|'TRADING' = pendiente, 'BUYER_PAYED'|'DISTRIBUTING' = pagado
                    const isPaymentPending = o.statusRaw === '10' || o.statusRaw === 'PENDING' || o.statusRaw === 'TRADING';
                    const isPaid          = o.statusRaw === '20' || o.statusRaw === 'BUYER_PAYED' || o.statusRaw === 'DISTRIBUTING';
                    const isDispute       = o.statusRaw === '50' || o.statusRaw === 'IN_APPEAL';

                    // Contador 30 minutos desde creación
                    const createdMs  = new Date(o.createdAt).getTime();
                    const limitMs    = 30 * 60 * 1000; // 30 min en ms
                    const elapsedMs  = Date.now() - createdMs;
                    const remainMs   = Math.max(0, limitMs - elapsedMs);
                    const remMin     = Math.floor(remainMs / 60000);
                    const remSec     = Math.floor((remainMs % 60000) / 1000);
                    const timerStr   = remainMs <= 0 ? '⏰ VENCIDA' : `${String(remMin).padStart(2,'0')}:${String(remSec).padStart(2,'0')}`;
                    const timerUrgent = remainMs < 5 * 60 * 1000 && remainMs > 0; // < 5 min
                    const timerExpired = remainMs <= 0;

                    // BUY/SELL
                    const isBuy  = o.side === 'BUY';
                    const isSell = o.side === 'SELL';

                    return (
                      <tr
                        key={o.bybitOrderId}
                        onClick={() => handleOrderClick(o)}
                        className={"border-b border-slate-800 hover:bg-slate-800/80 cursor-pointer transition-colors"}
                      >
                        {/* Orden ID */}
                        <td className="px-4 sm:px-6 py-4 font-mono text-xs whitespace-nowrap">
                          <div className="flex items-center gap-2 mb-1">
                            {/* Exchange badge */}
                            {o.exchange === 'bybit' ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-orange-500/15 text-orange-400 border border-orange-500/25 uppercase tracking-widest">
                                🟠 ByBit
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 uppercase tracking-widest">
                                🟡 Binance
                              </span>
                            )}
                          </div>
                          <span className="text-slate-300">{o.bybitOrderId?.slice(-8)}...</span>
                          <div className="text-slate-500 text-[10px] mt-0.5">
                            {new Date(o.createdAt).toLocaleString('es-VE', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {o.assignedUser && (
                              <div className="mt-1 flex items-center gap-1 text-[9px] text-indigo-400 font-bold px-1.5 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20 w-fit">
                                  <span>T/ {o.assignedUser.alias}</span>
                              </div>
                          )}
                        </td>
                        {/* Tipo BUY / SELL */}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          {isBuy ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              ↑ COMPRA
                            </span>
                          ) : isSell ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black bg-red-500/15 text-red-400 border border-red-500/30">
                              ↓ VENTA
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">{o.side || '—'}</span>
                          )}
                        </td>
                        {/* Contraparte */}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
                              {(o.counterparty || 'N')[0].toUpperCase()}
                            </div>
                            <span className="text-slate-200 text-sm font-medium">{o.counterparty}</span>
                          </div>
                          {o.assignedUser && (
                            <div className="mt-1 text-[10px] text-indigo-400 font-bold tracking-wider uppercase">
                              → {o.assignedUser.alias}
                            </div>
                          )}
                        </td>
                        {/* Fiat */}
                        <td className="px-4 sm:px-6 py-4 font-semibold text-slate-200 whitespace-nowrap">
                          {o.amount && o.amount !== '—'
                            ? Number(o.amount).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                            : '—'} <span className="text-slate-500 text-xs">VES</span>
                        </td>
                        {/* Cripto */}
                        <td className="px-4 sm:px-6 py-4 font-bold text-emerald-400 whitespace-nowrap">
                          {o.quantity && o.quantity !== '—'
                            ? Number(o.quantity).toFixed(4)
                            : '—'} <span className="text-emerald-600 text-xs">USDT</span>
                        </td>
                        {/* Método de Pago */}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs text-slate-300">
                          {o.paymentMethod || '—'}
                        </td>
                        {/* Contador 30 min — componente en tiempo real */}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <P2pCountdown createdAt={o.createdAt} status={o.statusRaw} />
                        </td>
                        {/* Estado */}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          {isPaymentPending && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                              Pend. Pago
                            </span>
                          )}
                          {isPaid && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                              Pago Recibido
                            </span>
                          )}
                          {isDispute && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                              EN DISPUTA
                            </span>
                          )}
                          {!isPaymentPending && !isPaid && !isDispute && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
                              {o.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
      </div>

      {/* ADS_MONITOR: Tabla de anuncios monitoreados */}
      {false && (
      <div className={isFrankTheme ? "glow-card bg-[#020617] rounded-xl overflow-hidden mt-6" : isRafaTheme ? "glow-card-rafa bg-[#022c22] rounded-xl overflow-hidden mt-6" : "bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mt-6"}>
        <div className={isFrankTheme ? "px-6 py-4 border-b border-orange-500/10 flex justify-between items-center" : isRafaTheme ? "px-6 py-4 border-b border-emerald-500/10 flex justify-between items-center" : "px-6 py-4 border-b border-slate-800 flex justify-between items-center"}>
          <h2 className={isFrankTheme || isRafaTheme ? "font-black text-white flex items-center gap-2 font-mono" : "font-bold text-white flex items-center gap-2"}>
            <span className={`w-2 h-2 rounded-full ${isFrankTheme ? 'bg-orange-400' : isRafaTheme ? 'bg-emerald-400' : 'bg-cyan-400'} animate-pulse inline-block`}></span>
            {isFrankTheme || isRafaTheme ? <>ADS_MONITOR // <span className={isFrankTheme ? "text-orange-400/60" : "text-emerald-400/60"}>PRICE_TRACKER</span></> : 'Monitor de Anuncios Activos'}
          </h2>
          <span className="text-xs text-slate-500 font-mono">{Object.keys(adUpdates).length} ads detectados</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className={isFrankTheme ? "text-xs text-orange-500/60 uppercase bg-[#020617] font-mono tracking-wider" : isRafaTheme ? "text-xs text-emerald-500/60 uppercase bg-[#022c22] font-mono tracking-wider" : "text-xs text-slate-400 uppercase bg-slate-900/50"}>
              <tr>
                <th className="px-6 py-3">Ad ID</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Exchange</th>
                <th className="px-6 py-3">Banco</th>
                <th className="px-6 py-3">Último Precio</th>
                <th className="px-6 py-3">Último Update</th>
                <th className="px-6 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(adUpdates).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    Esperando actualizaciones de anuncios... (se pobla en tiempo real)
                  </td>
                </tr>
              ) : (
                Object.entries(adUpdates).map(([adId, ad]) => (
                  <tr key={adId} className={isFrankTheme ? "border-b border-orange-500/5 hover:bg-orange-500/5 transition-all" : isRafaTheme ? "border-b border-emerald-500/5 hover:bg-emerald-500/5 transition-all" : "border-b border-slate-800 hover:bg-slate-800/50 transition-colors"}>
                    <td className="px-6 py-3 font-mono text-xs text-slate-400">{adId}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${ad.adType === 'SELL' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {ad.adType}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-300 font-mono">{ad.exchange}</td>
                    <td className="px-6 py-3 text-xs text-slate-300">{ad.bank}</td>
                    <td className="px-6 py-3 font-mono font-bold text-white">{ad.price} <span className="text-xs text-slate-500">VES</span></td>
                    <td className="px-6 py-3 text-xs text-slate-400 font-mono">
                      {new Date(ad.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${ad.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ad.success ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`}></span>
                        {ad.success ? 'OK' : 'ERROR'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* SYSTEM_STATUS: Semáforo de salud del sistema */}
      <div className={isFrankTheme ? "glow-card bg-[#020617] rounded-xl p-5 mt-6" : isRafaTheme ? "glow-card-rafa bg-[#022c22] rounded-xl p-5 mt-6" : "bg-slate-900 border border-slate-800 rounded-xl p-5 mt-6"}>
        <h2 className={`font-mono font-black text-white mb-4 text-sm ${isFrankTheme || isRafaTheme ? '' : 'tracking-widest uppercase'}`}>
          {isFrankTheme || isRafaTheme ? <>SYSTEM_STATUS // <span className={isFrankTheme ? "text-orange-400/60" : "text-emerald-400/60"}>HEALTH_CHECK</span></> : '⚙️ Estado del Sistema'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Binance API — datos reales del backend */}
          {(() => {
            const s = systemHealth.binance;
            const dot = !s ? 'bg-slate-600' : s.status === 'ok' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : s.status === 'api_error' ? 'bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse';
            const label = !s ? 'Esperando primer check...' : s.message;
            const detail = !s ? 'Sin datos aún — check cada 60s' : s.status === 'ok' ? 'API Key válida y con permisos. Conectado.' : s.status === 'api_error' ? 'Error en API Key/Secret o sin permisos de Merchant P2P.' : 'Sin respuesta de Binance. Posible problema de red.';
            const detailColor = !s ? 'text-slate-600' : s.status === 'ok' ? 'text-emerald-500/70' : s.status === 'api_error' ? 'text-yellow-500/80' : 'text-red-400/80';
            return (
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${isFrankTheme ? 'bg-[#0a0a0a] border-orange-500/10' : isRafaTheme ? 'bg-[#064e3b]/30 border-emerald-500/10' : 'bg-slate-950 border-slate-800'}`}>
                <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${dot}`}></span>
                <div>
                  <p className="text-white text-xs font-bold font-mono">BINANCE API</p>
                  <p className="text-slate-500 text-[10px] font-mono leading-tight mt-0.5">{label}</p>
                  <p className={`text-[10px] font-mono leading-tight mt-1 ${detailColor}`}>{detail}</p>
                </div>
              </div>
            );
          })()}

          {/* Market Scanner — basado en señal WebSocket */}
          {(() => {
            const alive = lastScannerPing && (Date.now() - lastScannerPing) < 60000;
            const dot = !lastScannerPing ? 'bg-slate-600' : alive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]';
            const scanLabel = !lastScannerPing ? 'Sin señal aún' : alive ? `Último scan: ${new Date(lastScannerPing).toLocaleTimeString()}` : 'Sin actualización reciente';
            const detail = !lastScannerPing ? 'El market-scanner no ha emitido datos aún.' : alive ? 'Scanner activo. Precios actualizándose cada ~15s.' : 'Sin actualización reciente. El scanner puede estar caído.';
            const detailColor = !lastScannerPing ? 'text-slate-600' : alive ? 'text-emerald-500/70' : 'text-yellow-500/80';
            return (
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${isFrankTheme ? 'bg-[#0a0a0a] border-orange-500/10' : isRafaTheme ? 'bg-[#064e3b]/30 border-emerald-500/10' : 'bg-slate-950 border-slate-800'}`}>
                <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${dot}`}></span>
                <div>
                  <p className="text-white text-xs font-bold font-mono">MARKET SCANNER</p>
                  <p className="text-slate-500 text-[10px] font-mono leading-tight mt-0.5">{scanLabel}</p>
                  <p className={`text-[10px] font-mono leading-tight mt-1 ${detailColor}`}>{detail}</p>
                </div>
              </div>
            );
          })()}

          {/* Bybit API — datos reales del backend */}
          {(() => {
            const s = systemHealth.bybit;
            const dot = !s ? 'bg-slate-600' : s.status === 'ok' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : s.status === 'api_error' ? 'bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse';
            const label = !s ? 'Esperando primer check...' : s.message;
            const detail = !s ? 'Sin datos aún — check cada 60s' : s.status === 'ok' ? 'Bybit conectado. Auto-pricing operativo.' : s.status === 'api_error' ? 'Error en API Key/Secret de Bybit o sin permisos P2P.' : 'Sin respuesta de Bybit. Posible problema de red.';
            const detailColor = !s ? 'text-slate-600' : s.status === 'ok' ? 'text-emerald-500/70' : s.status === 'api_error' ? 'text-yellow-500/80' : 'text-red-400/80';
            return (
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${isFrankTheme ? 'bg-[#0a0a0a] border-orange-500/10' : isRafaTheme ? 'bg-[#064e3b]/30 border-emerald-500/10' : 'bg-slate-950 border-slate-800'}`}>
                <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${dot}`}></span>
                <div>
                  <p className="text-white text-xs font-bold font-mono">BYBIT / AUTO-PRICING</p>
                  <p className="text-slate-500 text-[10px] font-mono leading-tight mt-0.5">{label}</p>
                </div>
              </div>
            );
          })()}

        </div>
      </div>

      <section className={isFrankTheme ? "glow-card bg-[#020617] rounded-xl p-6 mt-8 relative overflow-hidden" : isRafaTheme ? "glow-card-rafa bg-[#022c22] rounded-xl p-6 mt-8 relative overflow-hidden" : "bg-red-950/20 border border-red-900/50 rounded-xl p-6 mt-8"} style={isFrankTheme ? {borderColor: 'rgba(239,68,68,0.15)'} : isRafaTheme ? {borderColor: 'rgba(239,68,68,0.15)'} : undefined}>
        {isFrankTheme && <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-red-500/50 via-transparent to-transparent"></div>}
        {isRafaTheme && <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-red-500/50 via-transparent to-transparent"></div>}
        <h2 className={isFrankTheme || isRafaTheme ? "text-xl font-black text-red-400 mb-4 flex items-center gap-2 font-mono" : "text-xl font-bold text-red-400 mb-4 flex items-center gap-2"}>
          <AlertOctagon /> {isFrankTheme || isRafaTheme ? 'EMERGENCY_KILLSWITCH' : 'Panel de Emergencia P2P'}
        </h2>
        <p className={isFrankTheme || isRafaTheme ? "text-slate-500 mb-4 text-sm max-w-2xl font-mono" : "text-slate-400 mb-4 text-sm max-w-2xl"}>
          {isFrankTheme || isRafaTheme ? '// Desconecta la lectura API y pausa bots. Órdenes congeladas hasta nuevo aviso.' : 'Desconecta la lectura de la API y pausa los bots de enrutamiento. Las órdenes en ByBit quedarán congeladas hasta nuevo aviso.'}
        </p>
        <button 
          onClick={handleKillSwitch}
          disabled={!systemActive}
          className={isFrankTheme || isRafaTheme ? "bg-red-600/80 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.2)] flex items-center justify-center gap-2 transition-all w-full sm:w-auto border border-red-500/30 font-mono tracking-wider" : "bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"}
        >
          <AlertOctagon className="w-5 h-5" />
          {isFrankTheme ? (systemActive ? 'SHUTDOWN_MARKETPLACE' : 'MARKETPLACE_OFFLINE') : (systemActive ? 'APAGAR MESA DE DINERO' : 'MARKETPLACE FUERA DE LÍNEA')}
        </button>
      </section>

      {/* Panel Lateral Modal para Contacto Directo C2C */}
      {selectedOrderDetails && (
         <div className={isFrankTheme ? "fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md" : isRafaTheme ? "fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md" : "fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"}>
            <div className={isFrankTheme ? "w-full md:w-[450px] bg-[#0a0a0a] border-l border-orange-500/10 p-6 flex flex-col shadow-[0_0_50px_rgba(251,146,60,0.05)] h-full animate-in slide-in-from-right duration-300 relative overflow-hidden" : isRafaTheme ? "w-full md:w-[450px] bg-[#022c22] border-l border-emerald-500/10 p-6 flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.05)] h-full animate-in slide-in-from-right duration-300 relative overflow-hidden" : "w-full md:w-[450px] bg-slate-950 border-l border-slate-800 p-6 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] h-full animate-in slide-in-from-right duration-300"}>
               {isFrankTheme && <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-orange-500/30 via-transparent to-amber-500/30"></div>}
               {isRafaTheme && <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-emerald-500/30 via-transparent to-teal-500/30"></div>}
               <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className={isFrankTheme ? "text-xl font-black text-white flex items-center gap-2 font-mono" : "text-xl font-bold text-white flex items-center gap-2"}>
                      <Users className={`w-5 h-5 ${isFrankTheme ? 'text-orange-400' : 'text-indigo-400'}`} /> {isFrankTheme ? 'COUNTERPARTY_DATA' : 'Detalle Biográfico'}
                    </h3>
                    <p className={`text-xs font-mono ${isFrankTheme ? 'text-orange-500/40' : 'text-slate-500'} mt-1`}>{isFrankTheme ? `// ORDER #${selectedOrderDetails.bybitOrderId}` : `Order #${selectedOrderDetails.bybitOrderId}`}</p>
                 </div>
                 <button 
                    className={isFrankTheme ? "w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 border border-orange-500/10 text-slate-400 hover:text-orange-400 hover:border-orange-500/30 transition-all" : "w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"}
                    onClick={() => setSelectedOrderDetails(null)}
                  >
                    ✖
                 </button>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-6 hide-scrollbar">
                 <div className={isFrankTheme ? "bg-orange-950/10 p-5 rounded-2xl border border-orange-500/15 hover:border-orange-500/30 transition-colors" : isRafaTheme ? "bg-emerald-950/10 p-5 rounded-2xl border border-emerald-500/15 hover:border-emerald-500/30 transition-colors" : "bg-indigo-950/20 p-5 rounded-2xl border border-indigo-500/20 hover:border-indigo-500/40 transition-colors"}>
                   <h4 className={isFrankTheme ? "font-bold text-orange-400 mb-3 flex items-center gap-2 font-mono text-sm" : isRafaTheme ? "font-bold text-emerald-400 mb-3 flex items-center gap-2 font-mono text-sm" : "font-bold text-indigo-400 mb-3 flex items-center gap-2"}>
                     <Layers className="w-4 h-4" /> KYC del Maker/Taker
                   </h4>
                   {isCounterpartyLoading ? (
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

                          {/* Siempre mostrar el boton de accion */}
                            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg text-center mb-4 mt-2">
                              <p className="text-xs text-rose-400 font-bold mb-1">Solicitar / Corregir Datos en Chat</p>
                              <button
                                onClick={() => handleRequestCI(selectedOrderDetails.bybitOrderId)}
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
                              onClick={() => refreshChatData(selectedOrderDetails.bybitOrderId, 'binance')}
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
                        {(selectedOrderDetails.counterparty.result.chatOnlyAccount || selectedOrderDetails.counterparty.result.chatOnlyCedula) && (
                           <div className="bg-slate-900 p-4 rounded-xl border-l-[3px] border-l-cyan-500 border border-slate-800 shadow-inner mt-2">
                             <p className="text-cyan-400 font-bold mb-3 flex justify-between items-center text-sm">
                               <span>💬 Datos de Pago en Chat</span>
                               <span className="text-xs bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded-full animate-pulse">En vivo</span>
                             </p>
                             <div className="space-y-3 text-sm font-mono">
                               {selectedOrderDetails.counterparty.result.chatOnlyAccount && (
                                 <p className="flex justify-between items-center">
                                   <span className="text-slate-500">CUENTA:</span>
                                   <span className="flex items-center gap-2 text-white">
                                     {selectedOrderDetails.counterparty.result.chatOnlyAccount}
                                     <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.counterparty.result.chatOnlyAccount)} className="text-slate-500 hover:text-cyan-400 transition-colors"><Copy className="w-4 h-4"/></button>
                                   </span>
                                 </p>
                               )}
                               {selectedOrderDetails.counterparty.result.chatOnlyCedula && (
                                 <p className="flex justify-between items-center">
                                   <span className="text-slate-500">CÉDULA:</span>
                                   <span className="flex items-center gap-2 text-white">
                                     {selectedOrderDetails.counterparty.result.chatOnlyCedula}
                                     <button onClick={() => navigator.clipboard.writeText(selectedOrderDetails.counterparty.result.chatOnlyCedula)} className="text-slate-500 hover:text-cyan-400 transition-colors"><Copy className="w-4 h-4"/></button>
                                   </span>
                                 </p>
                               )}
                               <button
                                 onClick={() => {
                                   const amount = selectedOrderDetails.amountFiat
                                     ? Number(selectedOrderDetails.amountFiat).toFixed(2)
                                     : '';
                                   const parts = [
                                     amount,
                                     selectedOrderDetails.counterparty.result.chatOnlyAccount,
                                     selectedOrderDetails.counterparty.result.chatOnlyCedula,
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
                        
                        <div className="bg-slate-900 border-l border-slate-700/50 p-6 flex flex-col pt-12">
                        <h3 className="text-xl font-bold text-white mb-2 pb-2 border-b border-slate-700">Detalles de la Contraparte</h3>
                        
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg mb-4 flex flex-col items-center">
                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Total a Transferir</span>
                            <div className="flex items-center gap-2">
                               <span className="text-white font-black text-2xl">{Number(selectedOrderDetails.amountFiat).toLocaleString()} VES</span>
                               <button onClick={() => navigator.clipboard.writeText(String(selectedOrderDetails.amountFiat))} className="text-emerald-500/50 hover:text-emerald-400 transition-colors">
                                  <Copy className="w-5 h-5"/>
                               </button>
                            </div>
                        </div>

                        {/* Botón Copiar Todo de un click */}
                        {(() => {
                           const cp = selectedOrderDetails.counterparty?.result;
                           const term = cp?.paymentTermList?.[0];
                           const cuenta = term?.accountNo || cp?.chatDetectedAccount || '';
                           const textFields = [term?.paymentText1, term?.paymentText2, term?.paymentText3, term?.paymentText4, term?.paymentText5];
                           const bybitPersonalId = textFields.find(t => t && /^\d+$/.test(String(t).replace(/\D/g, ''))) || textFields.find(Boolean) || '';
                           const cedula = cp?.identityNo || bybitPersonalId || cp?.chatDetectedCedula || '';
                           const montoRaw = selectedOrderDetails.amountFiat || '';
                           const monto = montoRaw ? Number(montoRaw).toFixed(2) : '';
                           if (!cuenta && !cedula) return null;
                           const copyText = [monto, cuenta, cedula].filter(Boolean).join(' \n ');
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

                        <p className="text-slate-400 mb-4 text-xs">Sube un comprobante. El bot lo enviará automáticamente al chat antes de soltar la orden a Bybit.</p>
                            
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleFileChange}
                                className={isFrankTheme ? "w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-500/10 file:text-orange-400 hover:file:bg-orange-500/20 mb-3 cursor-pointer" : isRafaTheme ? "w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 mb-3 cursor-pointer" : "w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 mb-3 cursor-pointer"}
                            />
                            
                            {receiptImageBase64 && (
                                <div className={isFrankTheme ? "mb-4 rounded-lg overflow-hidden border border-orange-500/20 max-h-40 relative" : isRafaTheme ? "mb-4 rounded-lg overflow-hidden border border-emerald-500/20 max-h-40 relative" : "mb-4 rounded-lg overflow-hidden border border-indigo-500/30 max-h-40 relative"}>
                                    <img src={receiptImageBase64} alt="Preview" className="w-full object-cover" />
                                    <div className={isFrankTheme ? "absolute inset-0 top-auto bg-gradient-to-t from-slate-900 to-transparent p-2 text-center text-[10px] text-orange-400 font-bold" : isRafaTheme ? "absolute inset-0 top-auto bg-gradient-to-t from-slate-900 to-transparent p-2 text-center text-[10px] text-emerald-400 font-bold" : "absolute inset-0 top-auto bg-gradient-to-t from-slate-900 to-transparent p-2 text-center text-[10px] text-indigo-400 font-bold"}>IMG PROCESADA</div>
                                </div>
                            )}

                            <div className="flex flex-col xl:flex-row gap-2">
                                <button
                                    onClick={() => handleMarkAsPaid(selectedOrderDetails.bybitOrderId)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-xs font-bold transition-all border border-slate-700"
                                >
                                    Pagar Sin Adjunto
                                </button>
                                <button
                                    onClick={() => handleMarkAsPaidWithReceipt(selectedOrderDetails.bybitOrderId)}
                                    disabled={isSendingReceipt || !receiptImageBase64}
                                    className={`flex-1 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2.5 rounded-lg text-xs font-bold transition-all shadow-md flex justify-center items-center h-[38px] ${isFrankTheme ? 'bg-orange-600 hover:bg-orange-500' : isRafaTheme ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                                >
                                    {isSendingReceipt ? 'Informando...' : 'Informar + Adjunto'}
                                </button>
                            </div>
                        </div>
                     </div>
                   ) : (
                     <p className="text-xs bg-red-950/20 p-4 rounded-xl text-red-400 border border-red-900/30 text-center">No se pudo forzar la apertura de la identidad de la red.</p>
                   )}
                 </div>

                 <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
                   <h4 className="font-bold text-emerald-400 mb-3 flex items-center gap-2 text-sm">
                     <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                     </span>
                     Subrutina Chat Auto-Pilot
                   </h4>
                   <textarea
                     value={chatMessage}
                     onChange={(e) => setChatMessage(e.target.value)}
                     className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all mb-4 resize-none shadow-inner font-mono max-h-32"
                     rows={3}
                     placeholder="> Ingrese directiva al humano..."
                   ></textarea>
                   <button
                     onClick={handleSendChat}
                     disabled={isSendingChat || !chatMessage.trim()}
                     className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-all font-mono tracking-wider shadow-[0_0_15px_rgba(5,150,105,0.3)] hover:shadow-[0_0_20px_rgba(5,150,105,0.5)] flex justify-center items-center gap-2"
                   >
                     {isSendingChat ? (
                        <>
                           <RefreshCw className="w-4 h-4 animate-spin"/> Injecting...
                        </>
                     ) : 'EJECUTAR HANDSHAKE_CHAT()'}
                   </button>
                 </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
