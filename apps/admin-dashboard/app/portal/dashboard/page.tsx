'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, LogOut, ShieldCheck, Wallet, ArrowRightLeft, TrendingUp, TrendingDown, Clock, ActivitySquare, Terminal, PieChart as IconPieChart, ListChecks, DollarSign, Share2, CheckCircle, BarChart4, Menu, X, Camera, QrCode } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import html2canvas from 'html2canvas';
import { P2pMarketplaceView } from './components/P2pMarketplaceView';
import { TesoroBtcDashboard } from './components/TesoroBtcDashboard';


export default function InvestorDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [jwtToken, setJwtToken] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Nuevos estados para KNX10 y P2P
  const [activeTab, setActiveTab] = useState<'crypto' | 'index' | 'p2p' | 'tesoro'>('crypto');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [indexData, setIndexData] = useState<any>(null);
  const [userPosition, setUserPosition] = useState<any>(null);
  const [requestsHistory, setRequestsHistory] = useState<any[]>([]);
  const [isInvestModalOpen, setIsInvestModalOpen] = useState(false);
  const [investForm, setInvestForm] = useState({ amountUSDT: '', txHash: '', name: '', whatsapp: '' });
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amountUSDT: '', walletAddress: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [dailyPnlData, setDailyPnlData] = useState<Record<string, number>>({});
  
  const [isSpotModalOpen, setIsSpotModalOpen] = useState(false);
  const [spotForm, setSpotForm] = useState({ amountUSDT: '', asset: 'BTC' as 'BTC' | 'ETH' | 'SOL' });
  const [spotLoading, setSpotLoading] = useState(false);

  const [selectedDayObj, setSelectedDayObj] = useState<any>(null);
  const [calendarDate, setCalendarDate] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const calendarRef = useRef<HTMLDivElement>(null);
  const dailyCardRef = useRef<HTMLDivElement>(null);

  const goToPrevMonth = () => setCalendarDate(({ year, month }) => {
    if (month === 0) return { year: year - 1, month: 11 };
    return { year, month: month - 1 };
  });
  const goToNextMonth = () => setCalendarDate(({ year, month }) => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth()) return { year, month }; // no future
    if (month === 11) return { year: year + 1, month: 0 };
    return { year, month: month + 1 };
  });

  const handleShareCalendar = async () => {
      if (!calendarRef.current) return;
      try {
          const canvas = await html2canvas(calendarRef.current, { backgroundColor: '#0f172a', scale: 2 });
          const link = document.createElement('a');
          link.download = `rendimiento-mes-${profile?.alias}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
      } catch(e) {
          console.error(e);
      }
  };

  const handleShareDailyCard = async () => {
      if (!dailyCardRef.current || !selectedDayObj) return;
      try {
          const canvas = await html2canvas(dailyCardRef.current, { backgroundColor: '#020617', scale: 2 });
          const link = document.createElement('a');
          link.download = `pnl-diario-${selectedDayObj.dateStr}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
      } catch(e) {
          console.error(e);
      }
  };

  useEffect(() => {
    const fetchProfile = async () => {
       const cookies = document.cookie.split(';');
       const jwtCookie = cookies.find(c => c.trim().startsWith('ai_quant_jwt='));
       if (!jwtCookie) {
          router.push('/portal/login');
          return;
       }
       const token = jwtCookie.split('=')[1];
       setJwtToken(token);
       const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';

       try {
          const res = await fetch(`${BASE_URL}/community-users/me`, {
             headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
             const data = await res.json();
             setProfile(data);

             // Todos los fetches secundarios en PARALELO con manejo de error individual
             const safeJson = async (r: Response | null) => {
                if (!r || !r.ok) return null;
                try { return await r.json(); } catch { return null; }
             };

             const [indexRes, posRes, histRes, pnlRes] = await Promise.all([
                fetch(`${BASE_URL}/index-fund/dashboard`).catch(() => null),
                fetch(`${BASE_URL}/index-fund/user/${data.id}/position`).catch(() => null),
                fetch(`${BASE_URL}/index-fund/user/${data.id}/requests`).catch(() => null),
                fetch(`${BASE_URL}/community-users/internal/test-pnl/${data.id}`).catch(() => null),
             ]);

             const [indexData, posData, histData, pData] = await Promise.all([
                safeJson(indexRes),
                safeJson(posRes),
                safeJson(histRes),
                safeJson(pnlRes),
             ]);

             if (indexData) setIndexData(indexData);
             if (posData && posData.totalShares) setUserPosition(posData);
             if (histData) setRequestsHistory(histData);
             
             console.log('[Calendar] PnL data for user', data.id, ':', Object.keys(pData?.data || {}).length, 'days');
             if (pData && pData.success && pData.data) {
                setDailyPnlData(pData.data);
             }

          } else {
             document.cookie = "ai_quant_jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
             router.push('/portal/login');
          }
       } catch (e) {
          console.error(e);
       } finally {
          setLoading(false);
       }
    };
    fetchProfile();
  }, [router]);

  const handleLogout = () => {
     document.cookie = "ai_quant_jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
     router.push('/');
  }

  const handleSpotIncreaseSubmit = async (e: any) => {
      e.preventDefault();
      setSpotLoading(true);
      try {
          const cookies = document.cookie.split(';');
          const jwtCookie = cookies.find(c => c.trim().startsWith('ai_quant_jwt='));
          const token = jwtCookie ? jwtCookie.split('=')[1] : null;
          const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
          
          await fetch(`${BASE_URL}/community-users/me/spot-increase-request`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                  amountUSDT: Number(spotForm.amountUSDT),
                  asset: spotForm.asset
              })
          }).catch(() => null); // Silent fallback even if it fails to not block whatsapp

          const projectedTotal = (totalCapital + Number(spotForm.amountUSDT)).toLocaleString('en-US', {minimumFractionDigits: 2});
          
          const waMessage = `Soporte Agencia IA - Escala de Bóveda Spot\nHola, soy *${profile.alias}* y estoy listo para escalar mi bóveda VIP.\n\n*Estado Actual:* $${totalCapital.toLocaleString('en-US', {minimumFractionDigits: 2})} USDT\n*Inyección Solicitada:* +$${Number(spotForm.amountUSDT).toLocaleString()} USDT\n*Destino:* Bóveda ${spotForm.asset}\n*Nuevo Proyectado:* $${projectedTotal} USDT\n\nYa coloqué el dinero cargado en la billetera de Trading.`;
          const waUrl = "https://wa.me/584241692235?text=" + encodeURIComponent(waMessage);
          
          window.open(waUrl, '_blank');
          
          setIsSpotModalOpen(false);
          setSpotForm({ amountUSDT: '', asset: 'BTC' });
      } catch (error) {
          console.error(error);
      } finally {
          setSpotLoading(false);
      }
  };

  const handleInvestSubmit = async (e: any) => {
    e.preventDefault();
    setFormLoading(true);
    try {
        const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
        const res = await fetch(`${BASE_URL}/index-fund/invest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: profile.id,
                amountUSDT: Number(investForm.amountUSDT),
                txHash: investForm.txHash,
                name: investForm.name,
                whatsapp: investForm.whatsapp
            })
        });
        if (res.ok) {
            setSubmitSuccess(true);
            setTimeout(() => {
                setIsInvestModalOpen(false);
                setSubmitSuccess(false);
                setInvestForm({ amountUSDT: '', txHash: '', name: '', whatsapp: '' });
            }, 3000);
        }
    } catch (error) {
        console.error(error);
        alert("Error enviando solicitud.");
    } finally {
        setFormLoading(false);
    }
  };

  const handleWithdrawSubmit = async (e: any) => {
      e.preventDefault();
      setWithdrawLoading(true);
      try {
          const cookies = document.cookie.split(';');
          const jwtCookie = cookies.find(c => c.trim().startsWith('ai_quant_jwt='));
          const token = jwtCookie ? jwtCookie.split('=')[1] : null;
          const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
          const res = await fetch(`${BASE_URL}/index-fund/withdraw`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                  userId: profile.id,
                  amountUSDT: Number(withdrawForm.amountUSDT),
                  walletAddress: withdrawForm.walletAddress
              })
          });
          if (res.ok) {
              setSubmitSuccess(true);
              setTimeout(() => {
                  setIsWithdrawModalOpen(false);
                  setSubmitSuccess(false);
                  setWithdrawForm({ amountUSDT: '', walletAddress: '' });
              }, 3000);
          } else {
             const resp = await res.json();
             alert(resp.message || "Error al solicitar retiro");
          }
      } catch (error) {
          console.error(error);
          alert("Error de conexión.");
      } finally {
          setWithdrawLoading(false);
      }
  };

  if (loading) return (
     <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center text-white space-y-4">
        <Activity className="w-12 h-12 animate-[spin_2s_linear_infinite] text-emerald-500" />
        <p className="text-slate-400 font-mono tracking-widest text-xs">Desencriptando Bóveda...</p>
     </div>
  );

  if (!profile) return null;

  // Typecasting to Numbers to avoid string concat '$10000100000'
  const btcAllocation = Number(profile.btcCapitalAllocated) || 0;
  const ethAllocation = Number(profile.ethCapitalAllocated) || 0;
  const solAllocation = Number(profile.solCapitalAllocated) || 0;
  const xrpAllocation = Number(profile.xrpCapitalAllocated) || 0;
  const bnbAllocation = Number(profile.bnbCapitalAllocated) || 0;
  const totalCapital = Number(profile.capitalAllocated) || (btcAllocation + ethAllocation + solAllocation + xrpAllocation + bnbAllocation);
  
  const realizedPnl = Number(profile.realizedPnl) || 0;
  const unrealizedPnl = Number(profile.unrealizedPnl) || 0;
  
  const btcRoi = Number(profile.btcRoi) || 0;
  const ethRoi = Number(profile.ethRoi) || 0;
  const solRoi = Number(profile.solRoi) || 0;
  const xrpRoi = Number(profile.xrpRoi) || 0;
  const bnbRoi = Number(profile.bnbRoi) || 0;
  
  const btcUsdtGain = (btcAllocation * btcRoi) / 100;
  const ethUsdtGain = (ethAllocation * ethRoi) / 100;
  const solUsdtGain = (solAllocation * solRoi) / 100;
  const xrpUsdtGain = (xrpAllocation * xrpRoi) / 100;
  const bnbUsdtGain = (bnbAllocation * bnbRoi) / 100;

  const currentEquity = Number(profile.currentEquity) || (totalCapital + realizedPnl + unrealizedPnl);

  const metricsColor = realizedPnl >= 0 ? "text-emerald-400" : "text-rose-400";
  const IsUp = realizedPnl >= 0;

  const handleSharePnl = () => {
    let text = `🚀 Mi Portafolio Quant Core VIP\n💰 Capital Protegido: $${totalCapital.toLocaleString('en-US', {minimumFractionDigits: 2})}\n📈 PyG Realizado: ${realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)} USDT\n`;
    if (profile.btcEnabled) text += `🔥 BTC ROI: ${btcRoi >= 0 ? '+' : ''}${btcRoi.toFixed(2)}% ($${btcUsdtGain.toFixed(2)})\n`;
    if (profile.ethEnabled) text += `🔥 ETH ROI: ${ethRoi >= 0 ? '+' : ''}${ethRoi.toFixed(2)}% ($${ethUsdtGain.toFixed(2)})\n`;
    if (profile.solEnabled) text += `🔥 SOL ROI: ${solRoi >= 0 ? '+' : ''}${solRoi.toFixed(2)}% ($${solUsdtGain.toFixed(2)})\n`;
    if (profile.xrpEnabled) text += `🔥 XRP ROI: ${xrpRoi >= 0 ? '+' : ''}${xrpRoi.toFixed(2)}% ($${xrpUsdtGain.toFixed(2)})\n`;
    if (profile.bnbEnabled) text += `🔥 BNB ROI: ${bnbRoi >= 0 ? '+' : ''}${bnbRoi.toFixed(2)}% ($${bnbUsdtGain.toFixed(2)})\n`;
    text += `\n🛡️ Gestionado por IA Quant Core`;
    if (typeof navigator !== 'undefined' && navigator.share) {
       navigator.share({ title: 'Rendimiento Quant Core', text }).catch(console.error);
    } else {
       navigator.clipboard.writeText(text);
       alert('Rendimiento copiado al portapapeles 🚀');
    }
  };

  // Fake chart data based on PnL progression
  const generateChartData = () => {
     const data = [];
     const steps = 7;
     for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const value = realizedPnl * (progress * progress);
        data.push({
           name: `Corte ${i+1}`,
           BalanceEstimado: totalCapital + value,
        });
     }
     return data;
  };
  const chartData = generateChartData();
  const pieData = [
     { name: 'Bitcoin (BTC)', value: btcAllocation, color: '#f59e0b' },
     { name: 'Ethereum (ETH)', value: ethAllocation, color: '#6366f1' },
     { name: 'Solana (SOL)', value: solAllocation, color: '#14b8a6' },
     { name: 'XRP', value: xrpAllocation, color: '#0ea5e9' },
     { name: 'BNB', value: bnbAllocation, color: '#eab308' },
  ].filter(d => d.value > 0);
  if (pieData.length === 0) pieData.push({ name: 'Cash', value: 1, color: '#334155' });

  const renderCalendar = () => {
     const { year, month } = calendarDate;
     const today = new Date();
     const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
     
     const firstDay = new Date(year, month, 1);
     let startingDay = firstDay.getDay();
     if (startingDay === 0) startingDay = 7;
     
     const daysInMonth = new Date(year, month + 1, 0).getDate();
     const days = [];
     
     for (let i = 1; i < startingDay; i++) {
        days.push(null);
     }
     for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        days.push({ dayNumber: i, dateStr, pnl: dailyPnlData[dateStr] || 0 });
     }

     const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

     // Totals for the viewed month
     const monthTotal = days.reduce((sum, d) => d ? sum + (d.pnl || 0) : sum, 0);
     const positiveDays = days.filter(d => d && d.pnl > 0).length;

     return (
        <div ref={calendarRef} className="bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 lg:p-8 border border-white/5 shadow-2xl mt-8">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="font-black text-white uppercase tracking-widest text-lg flex items-center gap-3">
                     <Clock className="text-purple-400 w-5 h-5" /> 
                     Desempeño Diario
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">{monthNames[month]} {year} • Liquidaciones Cerradas</p>
               </div>
               <div className="flex items-center gap-2">
                  {/* Month navigation */}
                  <button
                    onClick={goToPrevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                    title="Mes anterior"
                  >
                    ‹
                  </button>
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest min-w-[90px] text-center">
                    {monthNames[month].substring(0,3)} {year}
                  </span>
                  <button
                    onClick={goToNextMonth}
                    disabled={isCurrentMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mes siguiente"
                  >
                    ›
                  </button>
                  <div className="w-px h-6 bg-slate-700 mx-1" />
                  <button onClick={handleShareCalendar} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors border border-slate-700 cursor-pointer">
                      <Camera className="w-3 h-3" /> Compartir
                  </button>
               </div>
            </div>

            {/* Month summary pill */}
            <div className="flex items-center gap-3 mb-6">
               <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                 monthTotal > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                 monthTotal < 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                 'bg-slate-800 text-slate-400 border-slate-700'
               }`}>
                 Total: {monthTotal > 0 ? '+' : ''}{monthTotal.toFixed(2)} USDT
               </span>
               {positiveDays > 0 && (
                 <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                   {positiveDays} días positivos
                 </span>
               )}
            </div>

            <div className="grid grid-cols-7 gap-2 md:gap-4">
               {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
                  <div key={idx} className="text-center text-slate-500 font-bold text-xs uppercase tracking-widest pb-4">
                     {day}
                  </div>
               ))}
               {days.map((dayObj, idx) => {
                  if (!dayObj) return <div key={idx} className="h-16 md:h-24"></div>;
                  
                  const isPositive = dayObj.pnl > 0;
                  const isNegative = dayObj.pnl < 0;
                  const isZero = dayObj.pnl === 0;
                  const isToday = isCurrentMonth && dayObj.dayNumber === today.getDate();

                  return (
                     <div key={idx} 
                          onClick={() => { if(!isZero) setSelectedDayObj(dayObj); }}
                          className={`relative h-16 md:h-24 rounded-xl flex flex-col items-center justify-center p-1 md:p-2 border transition-all ${
                            isPositive ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer' : 
                            (isNegative ? 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20 cursor-pointer' : 
                            'bg-slate-800/30 border-slate-700/50')
                         } ${isToday ? 'ring-2 ring-purple-500/50' : ''}`}
                     >
                        <span className={`text-sm md:text-lg font-bold mb-1 ${isZero ? 'text-slate-400' : 'text-white'}`}>
                           {dayObj.dayNumber}
                        </span>
                        <span className={`text-[10px] md:text-xs font-black tracking-tighter ${isPositive ? 'text-emerald-400' : (isNegative ? 'text-rose-400' : 'text-slate-500')}`}>
                           {isPositive ? '+' : ''}{dayObj.pnl.toFixed(2)}
                        </span>
                     </div>
                  );
               })}
            </div>
        </div>
     );
  };


  return (
    <div className="bg-[#030712] min-h-screen text-slate-50 font-sans p-4 md:p-8 relative overflow-x-hidden">
      {/* Premium Ambience Radials */}
      <div className={`absolute top-0 right-0 w-[800px] h-[800px] rounded-full blur-[200px] opacity-20 pointer-events-none ${activeTab === 'crypto' && IsUp ? 'bg-emerald-600' : (activeTab === 'index' ? 'bg-indigo-600' : 'bg-rose-600')} -translate-y-1/2 translate-x-1/3`} />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-10 pointer-events-none bg-blue-600 translate-y-1/3 -translate-x-1/3" />
      
      <div className="max-w-[1400px] mx-auto relative z-10">
        
        {/* Header Elegante */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 relative">
            <div className="flex justify-between items-center w-full md:w-auto">
               <div>
                   <h1 className="text-3xl md:text-4xl tracking-tighter font-extrabold text-white mb-2 flex items-center gap-3">
                      <button 
                          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                          className="md:hidden p-2 rounded-lg bg-slate-800/50 text-slate-300 hover:text-white border border-slate-700/50 transition-colors cursor-pointer mr-1"
                      >
                          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                      </button>
                      <span className={`text-transparent bg-clip-text bg-gradient-to-r line-clamp-1 ${activeTab === 'index' ? 'from-indigo-400 to-cyan-500' : 'from-emerald-400 to-teal-500'}`}>
                         Quant Core
                      </span>
                      <span className="text-slate-600 font-light hidden sm:block">|</span>
                      <span className="text-3xl font-light hidden sm:block">VIP</span>
                   </h1>
                   <div className="flex items-center gap-3 bg-slate-900/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 w-fit md:ml-0 ml-[52px]">
                      <span className="flex h-2.5 w-2.5 relative">
                         <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeTab === 'index' ? 'bg-indigo-400' : 'bg-emerald-400'}`}></span>
                         <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeTab === 'index' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                      </span>
                      <p className="text-xs font-semibold tracking-widest text-slate-300 uppercase">{profile.alias} • SESIÓN SEGURA</p>
                   </div>
               </div>
            </div>
            
            <button onClick={handleLogout} className="px-5 py-2.5 hidden md:flex bg-slate-900/80 backdrop-blur-md border border-slate-700/50 hover:border-slate-500 rounded-xl text-slate-400 hover:text-white transition-all items-center gap-2 text-sm font-bold shadow-xl group cursor-pointer w-full md:w-auto mt-4 md:mt-0 justify-center">
               Salir de la Bóveda <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Menú Desplegable Móvil */}
            {isMobileMenuOpen && (
               <div className="md:hidden absolute top-[100%] left-0 right-0 mt-4 bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl z-50 p-4 animate-in slide-in-from-top-4 duration-300">
                   <div className="flex flex-col gap-2">
                     <button 
                         onClick={() => { setActiveTab('crypto'); setIsMobileMenuOpen(false); }}
                         className={`w-full cursor-pointer text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all flex gap-3 items-center ${activeTab === 'crypto' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'}`}
                     >
                         <Terminal className="w-5 h-5" /> Bóveda Spot Bybit
                     </button>
                     <button 
                         onClick={() => { setActiveTab('index'); setIsMobileMenuOpen(false); }}
                         className={`w-full cursor-pointer text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all flex gap-3 items-center ${activeTab === 'index' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'}`}
                     >
                         <ActivitySquare className="w-5 h-5" /> KNX10 ETF
                     </button>
                     {profile?.p2pEnabled && (
                         <button 
                             onClick={() => { setActiveTab('p2p'); setIsMobileMenuOpen(false); }}
                             className={`w-full cursor-pointer text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all flex gap-3 items-center ${activeTab === 'p2p' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'}`}
                         >
                             <ArrowRightLeft className="w-5 h-5" /> P2P Marketplace
                         </button>
                     )}
                     {profile?.dcaEnabled && (
                          <button 
                              onClick={() => { setActiveTab('tesoro'); setIsMobileMenuOpen(false); }}
                              className={`w-full cursor-pointer text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all flex gap-3 items-center ${activeTab === 'tesoro' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/50' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'}`}
                          >
                              <span className="text-lg">₿</span> Tesoro BTC
                          </button>
                      )}
                     
                     <div className="h-px bg-slate-800 my-2"></div>
                     
                     <button onClick={handleLogout} className="w-full cursor-pointer text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all flex gap-3 items-center text-rose-400 hover:bg-rose-500/10 hover:text-rose-300">
                         <LogOut className="w-5 h-5" /> Cerrar Sesión
                     </button>
                   </div>
               </div>
            )}
        </header>

        {/* Main Section */}
        <div className="flex flex-col gap-8">

            {/* TAB SELECTOR DESKTOP */}
            <div className="hidden md:flex overflow-x-auto items-center gap-2 sm:gap-4 border border-slate-800 bg-slate-900/50 p-1.5 rounded-xl w-full sm:w-fit whitespace-nowrap hide-scrollbar">
                 <button 
                     onClick={() => setActiveTab('crypto')}
                     className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer flex gap-2 items-center ${activeTab === 'crypto' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                 >
                     <Terminal className="w-4 h-4" /> Bóveda Spot Bybit
                 </button>
                 <button 
                     onClick={() => setActiveTab('index')}
                     className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer flex gap-2 items-center ${activeTab === 'index' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                 >
                     <ActivitySquare className="w-4 h-4" /> KNX10 ETF
                 </button>
                 {profile?.p2pEnabled && (
                     <button 
                         onClick={() => setActiveTab('p2p')}
                         className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer flex gap-2 items-center ${activeTab === 'p2p' ? 'bg-indigo-600/30 text-emerald-400 border-emerald-500/50 shadow-lg' : 'text-slate-400 hover:text-white border border-transparent hover:border-emerald-500/50'}`}
                     >
                         <ArrowRightLeft className="w-4 h-4" /> P2P Marketplace
                     </button>
                 )}
                 {profile?.dcaEnabled && (
                      <button 
                          onClick={() => setActiveTab('tesoro')}
                          className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer flex gap-2 items-center ${activeTab === 'tesoro' ? 'bg-amber-500/20 text-amber-400 shadow-lg border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}
                      >
                          <span>₿</span> Tesoro BTC
                      </button>
                  )}
            </div>

            {activeTab === 'crypto' ? (
                <div className="animate-in fade-in zoom-in-95 duration-300 space-y-8">
                   {/* -- 1. FINANCIAL SUMMARY BAR (Al estilo del Admin) -- */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Capital Protegido */}
                      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 scale-150 transition-all duration-700 pointer-events-none z-0"><Wallet /></div>
                         <div className="flex justify-between items-center mb-4 relative z-[90]">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Capital Protegido Total</h3>
                            <button 
                               type="button"
                               onClick={(e) => { e.stopPropagation(); setIsSpotModalOpen(true); }}
                               className="pointer-events-auto text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                            >
                               ➕ Escalar Bóveda
                            </button>
                         </div>
                         <div className="flex items-end gap-2 mb-4">
                            <span className="text-4xl font-black text-white">${totalCapital.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                         </div>
                         <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                            {profile.btcEnabled && (
                               <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded">BTC: {btcAllocation.toLocaleString()}</span>
                            )}
                            {profile.ethEnabled && (
                               <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded">ETH: {ethAllocation.toLocaleString()}</span>
                            )}
                            {profile.solEnabled && (
                               <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-1 rounded">SOL: {solAllocation.toLocaleString()}</span>
                            )}
                            {profile.xrpEnabled && (
                               <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-1 rounded">XRP: {xrpAllocation.toLocaleString()}</span>
                            )}
             {profile.bnbEnabled && (
                <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded">BNB: {bnbAllocation.toLocaleString()}</span>
             )}
                         </div>
                      </div>

                      {/* PyG Realizado (ROI) */}
                      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                         <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">PyG Realizado (ROI)</h3>
                            <button onClick={handleSharePnl} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center justify-center p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30" title="Compartir Rendimiento">
                               <Share2 className="w-4 h-4" />
                            </button>
                         </div>
                         <div className={`flex items-end gap-2 mb-4 ${metricsColor}`}>
                            <span className="text-4xl font-black">{IsUp ? '+' : ''}{realizedPnl.toFixed(2)}</span>
                            <span className="text-sm font-medium mb-1">USDT</span>
                         </div>
                         <div className="flex flex-col gap-1">
                            {profile.btcEnabled && (
                               <span className={`text-[10px] font-mono px-2 py-0.5 rounded border max-w-max flex items-center gap-2 ${btcRoi >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                  BTC ROI: {btcRoi >= 0 ? '+' : ''}{btcRoi.toFixed(2)}% 
                                  <span className="opacity-75">(${btcUsdtGain.toFixed(2)})</span>
                               </span>
                            )}
                            {profile.ethEnabled && (
                               <span className={`text-[10px] font-mono px-2 py-0.5 rounded border max-w-max flex items-center gap-2 ${ethRoi >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                  ETH ROI: {ethRoi >= 0 ? '+' : ''}{ethRoi.toFixed(2)}% 
                                  <span className="opacity-75">(${ethUsdtGain.toFixed(2)})</span>
                               </span>
                            )}
                            {profile.solEnabled && (
                               <span className={`text-[10px] font-mono px-2 py-0.5 rounded border max-w-max flex items-center gap-2 ${solRoi >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                  SOL ROI: {solRoi >= 0 ? '+' : ''}{solRoi.toFixed(2)}% 
                                  <span className="opacity-75">(${solUsdtGain.toFixed(2)})</span>
                               </span>
                            )}
                            {profile.xrpEnabled && (
                               <span className={`text-[10px] font-mono px-2 py-0.5 rounded border max-w-max flex items-center gap-2 ${xrpRoi >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                  XRP ROI: {xrpRoi >= 0 ? '+' : ''}{xrpRoi.toFixed(2)}% 
                                  <span className="opacity-75">(${xrpUsdtGain.toFixed(2)})</span>
                               </span>
                            )}
                             {profile.bnbEnabled && (
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border max-w-max flex items-center gap-2 ${bnbRoi >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                                   BNB ROI: {bnbRoi >= 0 ? "+" : ""}{bnbRoi.toFixed(2)}% 
                                   <span className="opacity-75">(${ bnbUsdtGain.toFixed(2)})</span>
                                </span>
                             )}
                         </div>
                      </div>

                      {/* PyG Flotante & Equity Real */}
                      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                         <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">PyG Flotante</h3>
                         <div className={`flex items-end gap-2 mb-4 ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            <span className="text-4xl font-black">{unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}</span>
                            <span className="text-sm font-medium mb-1">USDT</span>
                         </div>
                         <div className="w-full h-[1px] bg-slate-800 my-2"></div>
                         <div className="flex justify-between items-center text-sm mt-3">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">Equity Real</span>
                            <span className="text-white font-black tracking-tighter">${currentEquity.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                         </div>
                      </div>

                   </div>

                   {/* -- 2. CHARTS & REPORTS ROW -- */}
                   <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                      
                      {/* Mega Gráfico de Rendimiento */}
                      <div className="xl:col-span-2 bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl">
                         <div className="flex items-center gap-3 mb-6 px-2">
                            <TrendingUp className="text-emerald-400 w-5 h-5" />
                            <h3 className="font-bold text-slate-200 uppercase tracking-widest text-sm">Curva de Rendimiento Estructural</h3>
                         </div>
                         <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                               <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <defs>
                                     <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={IsUp ? '#10b981' : '#f43f5e'} stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor={IsUp ? '#10b981' : '#f43f5e'} stopOpacity={0}/>
                                     </linearGradient>
                                  </defs>
                                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                  <Tooltip 
                                     contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px' }} 
                                     itemStyle={{ fontWeight: 'bold' }}
                                  />
                                  <Area type="monotone" dataKey="BalanceEstimado" stroke={IsUp ? '#34d399' : '#fb7185'} strokeWidth={3} fillOpacity={1} fill="url(#colorPnl)" activeDot={{ r: 6, fill: '#fff' }} />
                               </AreaChart>
                            </ResponsiveContainer>
                         </div>
                      </div>

                      {/* Asset Distribution */}
                      <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-2xl flex-1 flex flex-col items-center">
                         <div className="w-full flex items-center gap-3 mb-6">
                            <IconPieChart className="text-amber-400 w-5 h-5" />
                            <h3 className="font-bold text-slate-200 uppercase tracking-widest text-sm">Diversificación Activa</h3>
                         </div>
                         
                         <div className="h-[200px] w-full mb-4">
                            <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                  <Pie 
                                     data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} 
                                     paddingAngle={5} dataKey="value" stroke="none"
                                  >
                                     {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                     ))}
                                  </Pie>
                                  <Tooltip 
                                     contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px' }} 
                                     formatter={(value: any) => [`$${value.toLocaleString()}`, 'Capital Delegado']}
                                  />
                               </PieChart>
                            </ResponsiveContainer>
                         </div>
                         
                         {/* Legend */}
                         <div className="w-full flex flex-col gap-3 px-4">
                            {pieData.map((asset, i) => (
                               <div key={i} className="flex justify-between items-center bg-slate-950/50 px-4 py-3 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-2">
                                     <div className="w-3 h-3 rounded-full" style={{backgroundColor: asset.color}}></div>
                                     <span className="text-xs font-bold text-slate-300">{asset.name}</span>
                                  </div>
                                  <span className="text-sm font-black">${asset.value.toLocaleString()}</span>
                               </div>
                            ))}
                         </div>
                      </div>

                   </div>

                   {/* -- 3. PNL CALENDAR -- */}
                   {renderCalendar()}
                   
                  {isSpotModalOpen && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                          <div className="bg-slate-900 border border-emerald-500/20 w-full max-w-lg rounded-3xl p-8 shadow-2xl relative">
                              <button onClick={() => setIsSpotModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white transition cursor-pointer">
                                  <X className="w-6 h-6" />
                              </button>
                                  
                              <h2 className="text-2xl font-black text-white mb-2">Escalar Bóveda Spot</h2>
                              <p className="text-slate-400 text-sm mb-6">Incrementa tu capital protegido. Calcularemos tu nuevo apalancamiento y portafolio.</p>
                              
                              <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 mb-6">
                                  <div className="flex justify-between text-sm mb-2">
                                      <span className="text-slate-400">Capital Actual:</span>
                                      <span className="text-white font-bold">${totalCapital.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                  </div>
                                  <div className="flex justify-between text-base pt-3 border-t border-slate-800 mt-2">
                                      <span className="text-emerald-400 font-bold">Nuevo Proyectado:</span>
                                      <span className="text-emerald-400 font-black">${(totalCapital + Number(spotForm.amountUSDT || 0)).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                  </div>
                              </div>

                              <form onSubmit={handleSpotIncreaseSubmit} className="space-y-4">
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 uppercase">Input a Inyectar (USDT)</label>
                                      <input required type="number" min="10" step="any" placeholder="Ej. 5000" value={spotForm.amountUSDT} onChange={e => setSpotForm({...spotForm, amountUSDT: e.target.value})} className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono" />
                                  </div>
                                  
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Bóveda Destino</label>
                                      <div className="grid grid-cols-3 gap-2">
                                          {['BTC', 'ETH', 'SOL'].map((asset: any) => (
                                              <button
                                                  key={asset}
                                                  type="button"
                                                  onClick={() => setSpotForm({...spotForm, asset})}
                                                  className={`py-2 rounded-lg font-bold text-sm transition-all border ${spotForm.asset === asset ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'}`}
                                              >
                                                  {asset}
                                              </button>
                                          ))}
                                      </div>
                                  </div>

                                  <button disabled={spotLoading} type="submit" className="w-full h-14 flex items-center justify-center gap-2 cursor-pointer bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3.5 px-4 rounded-xl mt-6 transition duration-200 shadow-[0_0_15px_rgba(37,211,102,0.3)] disabled:opacity-50">
                                      {spotLoading ? 'Procesando...' : (
                                          <>Contactar Asesor vía WhatsApp</>
                                      )}
                                  </button>
                              </form>
                          </div>
                      </div>
                  )}

                </div>
            ) : activeTab === 'index' ? (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 gap-4 mb-8">
                      <div>
                          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-teal-400">
                              KNX10 Smart ETF
                          </h1>
                          <p className="text-slate-400 mt-2 text-sm">Vehículo de Inversión Quant Autónomo Oficial de Agencia IA</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                          <button 
                              onClick={() => setIsInvestModalOpen(true)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-6 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 cursor-pointer"
                          >
                              <Wallet className="w-5 h-5" /> Adquirir Participaciones
                          </button>
                          <button 
                              onClick={() => setIsWithdrawModalOpen(true)}
                              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-white font-bold py-3 px-6 rounded-full transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 cursor-pointer"
                          >
                              <ArrowRightLeft className="w-5 h-5" /> Retirar Valor
                          </button>
                      </div>
                  </div>

                  {userPosition && (
                      <div className="mb-8 bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl p-6 lg:p-8 relative">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl mix-blend-screen pointer-events-none rounded-full"></div>
                          <div className="flex items-center gap-3 mb-8">
                              <Wallet className="w-6 h-6 text-indigo-400" />
                              <h2 className="text-2xl font-black text-white">Tu Portafolio KNX10</h2>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              <div className="bg-[#0b0f19]/80 border border-slate-800 p-5 rounded-2xl">
                                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Capital Depositado</p>
                                  <p className="text-2xl font-black text-white">${Number(userPosition.totalInvested).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                              </div>
                              <div className="bg-[#0b0f19]/80 border border-slate-800 p-5 rounded-2xl border-b-2 border-b-indigo-500">
                                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Participaciones KNX10</p>
                                  <p className="text-2xl font-black text-indigo-400">{Number(userPosition.totalShares).toLocaleString(undefined, {minimumFractionDigits: 4})} Acciones</p>
                              </div>
                              <div className="bg-[#0b0f19]/80 border border-slate-800 p-5 rounded-2xl">
                                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Valor Dinámico Actual</p>
                                  <p className="text-2xl font-black text-white">${Number(userPosition.currentValue).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                              </div>
                              <div className="bg-[#0b0f19]/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
                                  <div className="absolute top-0 right-0 h-full w-1 bg-indigo-500"></div>
                                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Rentabilidad PNL</p>
                                  <div className="flex flex-col">
                                      <span className={`text-2xl font-black ${userPosition.profitValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                          {userPosition.profitValue >= 0 ? '+' : ''}${parseFloat(userPosition.profitValue).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                      </span>
                                      <span className={`text-sm font-bold ${userPosition.profitValue >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                          {userPosition.profitPercentage >= 0 ? '+' : ''}{parseFloat(userPosition.profitPercentage).toFixed(2)}%
                                      </span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {indexData ? (
                      <div className="space-y-8">
                          <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-6 opacity-3 group-hover:opacity-10 transition-opacity pointer-events-none">
                              <ActivitySquare className="w-64 h-64 text-indigo-500" />
                          </div>
                          <div className="flex justify-between items-start mb-6">
                              <div className="z-10">
                                  <h3 className="text-2xl font-black flex items-center gap-2 text-white"><Activity className="text-indigo-400 w-5 h-5" /> Rendimiento YTD</h3>
                                  <p className="text-slate-400 text-sm mt-1">Precio Histórico del ETF (Inicio 01 Ene 2026: <b className="text-white">${indexData.knx10Quote?.genesisPrice || 369}</b>)</p>
                                  <p className="text-sm mt-2 font-black flex items-center gap-2">
                                      Valor actual de Participación <span className="px-3 py-1 bg-white/10 text-white rounded font-mono text-lg">${Number(indexData.knx10Quote?.currentPrice || 369).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                                  </p>
                              </div>
                              <div className="z-10 bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full border border-indigo-500/20 text-xs font-bold shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center gap-2">
                                  Histórico YTD <span className="text-white">({indexData.knx10Quote?.growthPercentage >= 0 ? '+' : ''}{indexData.knx10Quote?.growthPercentage?.toFixed(2)}%)</span>
                              </div>
                          </div>

                          <div className="h-[300px] w-full relative z-10">
                              <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={indexData.performanceHistory} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                      <defs>
                                          <linearGradient id="colorKnx10" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6}/>
                                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                          </linearGradient>
                                      </defs>
                                      <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${value.toLocaleString()}`} domain={['dataMin - 10', 'dataMax + 10']} />
                                      <Tooltip 
                                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                                          itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                                          formatter={(val: number) => [`$${val.toFixed(2)}`, 'Valor de 1 Participación KNX10']}
                                          labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                      />
                                      <Area type="monotone" dataKey="knx10Price" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorKnx10)" />
                                  </AreaChart>
                              </ResponsiveContainer>
                          </div>
                      </div>



                      {/* SECCIÓN EDUCATIVA */}
                      <div className="border border-slate-800 rounded-3xl bg-slate-950/80 overflow-hidden shadow-xl lg:px-8 px-6 py-10">
                          <div className="flex items-center gap-4 mb-6">
                              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                  <ActivitySquare className="w-8 h-8 text-indigo-400" />
                              </div>
                              <div>
                                  <h2 className="text-3xl font-extrabold text-white">¿Cómo funciona el KNX10 Smart ETF?</h2>
                                  <p className="text-slate-400">Transparencia algorítmica e Inteligencia Artificial pasiva a tu alcance.</p>
                              </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
                              <div className="space-y-3">
                                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
                                      <ShieldCheck className="w-5 h-5" /> 1. Cero Riesgo de Margin Call
                                  </div>
                                  <p className="text-slate-400 text-sm leading-relaxed">
                                      El Smart Index adquiere participaciones proporcionales en el mercado <b>SPOT (Contado)</b>. Las acciones que adquieres siempre estarán respaldadas 1:1 por capital en cripto original. Nunca hay apalancamiento riesgoso ni peligros de perder todo en caídas de vela.
                                  </p>
                              </div>

                              <div className="space-y-3">
                                  <div className="flex items-center gap-2 text-blue-400 font-bold text-lg">
                                      <Activity className="w-5 h-5" /> 2. Composición Dinámica
                                  </div>
                                  <p className="text-slate-400 text-sm leading-relaxed">
                                      No nos casamos con ninguna moneda. El sistema <b>filtra la liquidez global 24/7</b>. Tu capital en el KNX10 rotará automáticamente a los verdaderos líderes institucionales para que no sufras mientras mantienes un Hold en activos obsoletos.
                                  </p>
                              </div>

                              <div className="space-y-3">
                                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg">
                                      <ShieldCheck className="w-5 h-5" /> 3. Facilidad y Retorno Premium
                                  </div>
                                  <p className="text-slate-400 text-sm leading-relaxed">
                                      Tú no tienes que operar ni gestionar Wallets. Aportas capital, obtienes participaciones KNX10 asignadas en el Panel, y revisas sus ganancias crecer como un fondo S&P500 pero potenciado por la extrema volatilidad alcista de las Cryptos.
                                  </p>
                              </div>
                          </div>
                      </div>

                      {/* HISTORIAL DE DEPÓSITOS Y RETIROS */}
                      <div className="mt-8 bg-slate-900 border border-white/5 rounded-2xl p-6 shadow-xl overflow-hidden relative">
                          <h3 className="text-xl font-bold flex items-center gap-2 text-white mb-6">
                              <ListChecks className="text-indigo-400 w-5 h-5" /> Historial de Depósitos y Retiros
                          </h3>
                          {requestsHistory.length > 0 ? (
                              <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse">
                                      <thead>
                                          <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                                              <th className="p-4 font-semibold whitespace-nowrap">Tipo</th>
                                              <th className="p-4 font-semibold whitespace-nowrap">Monto (USDT)</th>
                                              <th className="p-4 font-semibold whitespace-nowrap">Estado</th>
                                              <th className="p-4 font-semibold whitespace-nowrap">Fecha</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/50 text-sm">
                                          {requestsHistory.map((req: any) => (
                                              <tr key={req.id} className="hover:bg-slate-800/50 transition-colors">
                                                  <td className="p-4 whitespace-nowrap">
                                                      <span className={`px-2 py-1 flex items-center w-fit gap-1.5 rounded text-xs font-bold ${req.type === 'INVESTMENT' || req.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                          {req.type === 'INVESTMENT' || req.type === 'DEPOSIT' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                          {req.type === 'INVESTMENT' || req.type === 'DEPOSIT' ? 'Depósito' : 'Retiro'}
                                                      </span>
                                                  </td>
                                                  <td className="p-4 text-white font-mono font-bold whitespace-nowrap">${Number(req.amountUSDT).toLocaleString()}</td>
                                                  <td className="p-4 whitespace-nowrap">
                                                      <span className={`px-2 py-1 rounded text-xs font-bold ${req.status === 'APPROVED' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : req.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                                          {req.status}
                                                      </span>
                                                  </td>
                                                  <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(req.createdAt).toLocaleDateString()}</td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          ) : (
                              <div className="text-center py-8">
                                  <p className="text-slate-500 font-medium">No tienes transacciones registradas aún. ¡Haz tu primer depósito!</p>
                              </div>
                          )}
                      </div>
                      {/* FIN HISTORIAL */}
                  </div>
                  ) : (
                      <div className="h-64 flex items-center justify-center border border-slate-800 rounded-2xl bg-slate-900/50 backdrop-blur-md">
                          <div className="animate-pulse flex flex-col items-center">
                              <BarChart4 className="w-12 h-12 text-slate-700 mb-2" />
                              <p className="text-slate-500 font-medium">Buscando telemetría del índice...</p>
                          </div>
                      </div>
                  )}

                  {isInvestModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-8 shadow-2xl relative">
                              <button onClick={() => setIsInvestModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white transition cursor-pointer">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                              
                              {!submitSuccess ? (
                                  <>
                                      <h2 className="text-2xl font-black text-white mb-2">Inversión en KNX10 ETF</h2>
                                      <p className="text-slate-400 text-sm mb-6">Transfiere USDT en cualquier red listada, tu pago será validado y emitido como acciones virtuales KNX10.</p>
                                      
                                      <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 mb-6 relative group overflow-hidden">
                                          <div className="absolute top-0 right-0 h-full w-2 bg-indigo-500"></div>
                                          <span className="text-xs font-bold text-slate-500 block mb-1">WALLETS MAESTRAS AGENCIA IA:</span>
                                          <span className="text-white font-mono text-sm block tracking-widest break-all">TRC20: TBXv... (Solicitar por interno)</span>
                                          <span className="text-white font-mono text-sm tracking-widest break-all mt-2 block">BEP20: 0xAbC...</span>
                                      </div>

                                      <form onSubmit={handleInvestSubmit} className="space-y-4">
                                          <div>
                                              <label className="text-xs font-bold text-slate-400 uppercase">Monto Invertido (USDT)</label>
                                              <input required type="number" min="10" step="any" placeholder="Ej. 1500" value={investForm.amountUSDT} onChange={e => setInvestForm({...investForm, amountUSDT: e.target.value})} className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono" />
                                          </div>
                                          <div>
                                              <label className="text-xs font-bold text-slate-400 uppercase">TxHash / Comprobante</label>
                                              <input required type="text" placeholder="Ej. 6facbaa..." value={investForm.txHash} onChange={e => setInvestForm({...investForm, txHash: e.target.value})} className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-sm" />
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                  <label className="text-xs font-bold text-slate-400 uppercase">Tu Nombre / Alias</label>
                                                  <input required type="text" placeholder="John Doe" value={investForm.name} onChange={e => setInvestForm({...investForm, name: e.target.value})} className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all" />
                                              </div>
                                              <div>
                                                  <label className="text-xs font-bold text-slate-400 uppercase">WhatsApp</label>
                                                  <input required type="text" placeholder="+58..." value={investForm.whatsapp} onChange={e => setInvestForm({...investForm, whatsapp: e.target.value})} className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all" />
                                              </div>
                                          </div>
                                          <button disabled={formLoading} type="submit" className="w-full cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl mt-6 transition duration-200 shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50">
                                              {formLoading ? 'Enviando...' : 'Reclamar Participaciones al Pagar'}
                                          </button>
                                      </form>
                                  </>
                              ) : (
                                  <div className="text-center py-6 animate-in zoom-in duration-300">
                                      <div className="mx-auto w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-4 border border-emerald-500">
                                          <CheckCircle className="w-8 h-8" />
                                      </div>
                                      <h2 className="text-2xl font-black text-white mb-2">¡Solicitud Enviada!</h2>
                                      <p className="text-slate-400 text-sm">Nuestro equipo validará el comprobante blockchain en breve. Cuando se apruebe, verás tus participaciones KNX10 en el apartado de Mi Portafolio.</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}

                  {isWithdrawModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-8 shadow-2xl relative">
                              <button onClick={() => setIsWithdrawModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white transition cursor-pointer">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                              
                              {!submitSuccess ? (
                                  <>
                                      <h2 className="text-2xl font-black text-white mb-2">Solicitar Retiro</h2>
                                      <p className="text-slate-400 text-sm mb-6">El monto solicitado será extraído de tu valor de portafolio y enviado a tu wallet externa (vía Redes Estándar TRC20/BEP20).</p>
                                      
                                      <div className="bg-[#0b0f19] p-4 rounded-xl border border-slate-800 mb-6">
                                          <div className="flex justify-between text-sm mb-2">
                                              <span className="text-slate-400">Valor Máximo Disponible:</span>
                                              <span className="text-emerald-400 font-bold">${userPosition?.currentValue ? Number(userPosition.currentValue).toLocaleString(undefined, {minimumFractionDigits: 2}) : '0.00'}</span>
                                          </div>
                                          <div className="flex justify-between text-sm mb-2">
                                              <span className="text-slate-400">Gestión y Txn de Red:</span>
                                              <span className="text-rose-400 font-bold text-xs bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">-$10.00 USDT</span>
                                          </div>
                                          <div className="flex justify-between text-base pt-3 border-t border-slate-800 mt-2">
                                              <span className="text-slate-300 font-bold">Total a Recibir (USDT):</span>
                                              <span className="text-white font-black">${Math.max(0, Number(withdrawForm.amountUSDT || 0) - 10).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                          </div>
                                      </div>

                                      <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                                          <div>
                                              <label className="text-xs font-bold text-slate-400 uppercase">Monto a Retirar (USDT)</label>
                                              <input required type="number" min="10" max={userPosition?.currentValue || 0} step="any" placeholder="Ej. 500" value={withdrawForm.amountUSDT} onChange={e => setWithdrawForm({...withdrawForm, amountUSDT: e.target.value})} className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-slate-500 transition-all font-mono" />
                                          </div>
                                          <div>
                                              <label className="text-xs font-bold text-slate-400 uppercase">Tu Dirección Wallet (TRC20 / BEP20)</label>
                                              <input required type="text" placeholder="TBX..." value={withdrawForm.walletAddress} onChange={e => setWithdrawForm({...withdrawForm, walletAddress: e.target.value})} className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-emerald-400 focus:outline-none focus:border-slate-500 transition-all font-mono text-sm" />
                                          </div>
                                          
                                          <button disabled={withdrawLoading} type="submit" className="w-full cursor-pointer bg-slate-100 hover:bg-white text-slate-900 font-bold py-3.5 px-4 rounded-xl mt-6 transition duration-200 disabled:opacity-50">
                                              {withdrawLoading ? 'Enviando Solicitud...' : 'Confirmar Retiro'}
                                          </button>
                                      </form>
                                  </>
                              ) : (
                                  <div className="text-center py-6 animate-in zoom-in duration-300">
                                      <div className="mx-auto w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-4 border border-emerald-500">
                                          <CheckCircle className="w-8 h-8" />
                                      </div>
                                      <h2 className="text-2xl font-black text-white mb-2">¡Solicitud Enviada!</h2>
                                      <p className="text-slate-400 text-sm">Nuestro equipo procesará la liquidación y la enviará a tu dirección provista. Puede tardar hasta 24 horas hábiles.</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}


                </div>
            ) : null}

            {activeTab === 'p2p' && (
                <P2pMarketplaceView profile={profile} />
            )}

            {activeTab === 'tesoro' && (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                  <TesoroBtcDashboard
                    token={jwtToken}
                    apiBase={process.env.NEXT_PUBLIC_API_URL || 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host'}
                  />
                </div>
            )}

            {selectedDayObj && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative">
                        <button onClick={() => setSelectedDayObj(null)} className="absolute -top-12 right-0 text-slate-400 hover:text-white transition cursor-pointer z-[60] bg-slate-800 rounded-full p-2">
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div ref={dailyCardRef} className="bg-[#020617] border border-slate-800 w-[400px] max-w-[95vw] rounded-3xl overflow-hidden relative shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                            {/* Decoraciones Ambientales */}
                            <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] opacity-20 pointer-events-none bg-emerald-600 -translate-y-1/2 translate-x-1/3"></div>
                            <div className="absolute bottom-0 left-0 w-[200px] h-[200px] rounded-full blur-[80px] opacity-10 pointer-events-none bg-indigo-600 translate-y-1/3 -translate-x-1/3"></div>
                            
                            {/* Grid Texture Overlay */}
                            <div className="absolute inset-x-0 inset-y-0 opacity-10 pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`, backgroundSize: '30px 30px' }}></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-80 pointer-events-none"></div>

                            <div className="p-8 relative z-10 pt-10">
                                <div className="flex justify-between items-center mb-10">
                                    <div className="font-black text-xl tracking-tighter flex items-center gap-1 text-white">
                                        JARVIS <span className="px-1 text-emerald-400 bg-emerald-500/10 rounded">.AI</span>
                                    </div>
                                    <div className="border border-emerald-500/30 text-emerald-400 text-[9px] font-mono tracking-widest px-2 py-0.5 rounded uppercase">
                                        Autonomous Quant
                                    </div>
                                </div>

                                <div className="mb-8 relative">
                                    {/* Logo de Agencia en el fondo (como marca de agua) */}
                                    <div className="absolute right-0 top-0 opacity-5 pointer-events-none rotate-12 scale-150">
                                        <ActivitySquare className="w-40 h-40 text-emerald-500" />
                                    </div>
                                    
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-3xl font-black text-white tracking-tight">{profile?.alias}</span>
                                        <span className="bg-emerald-500 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
                                            Trading • ByBit
                                        </span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-500 tracking-widest uppercase flex items-center gap-2 mb-2 mt-4">
                                        ROI P&L ({selectedDayObj.dateStr})
                                        <span className={`w-2 h-2 rounded-full animate-pulse ${selectedDayObj.pnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                    </div>
                                    
                                    <div className={`text-6xl font-black tracking-tighter ${selectedDayObj.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {selectedDayObj.pnl >= 0 ? '+' : ''}{selectedDayObj.pnl.toFixed(2)} USDT
                                    </div>
                                </div>

                                <div className="flex gap-8 border-t border-slate-800/80 pt-6 mt-10">
                                    <div className="flex-1">
                                        <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">Capital Operativo</div>
                                        <div className="text-lg font-black text-white">${(() => {
                                            const totalCapital = profile ? Number(profile.btcCapitalAllocated || 0) + Number(profile.ethCapitalAllocated || 0) + Number(profile.solCapitalAllocated || 0) : 0;
                                            return totalCapital.toLocaleString(undefined, {minimumFractionDigits: 2});
                                        })()}</div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">Rendimiento ROI</div>
                                        <div className={`text-lg font-black ${selectedDayObj.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {selectedDayObj.pnl >= 0 ? '+' : ''}
                                            {(() => {
                                                const totalCapital = profile ? Number(profile.btcCapitalAllocated || 0) + Number(profile.ethCapitalAllocated || 0) + Number(profile.solCapitalAllocated || 0) : 0;
                                                if(totalCapital === 0) return '0.00';
                                                return ((selectedDayObj.pnl / totalCapital) * 100).toFixed(2);
                                            })()}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 border-t-4 border-slate-50 relative z-10 px-8 py-5 flex items-center justify-between mt-4 overflow-hidden rounded-b-2xl">
                                <div className="z-10">
                                    <div className="text-slate-500 text-xs mb-0.5 font-medium">Comunidad Privada de Inteligencia Artificial</div>
                                    <div className="text-slate-900 font-extrabold text-lg uppercase tracking-tight">VIP POOL INVERSIONISTAS</div>
                                </div>
                                <QrCode className="w-10 h-10 text-slate-800 z-10 opacity-80" />
                            </div>
                        </div>

                        <button onClick={handleShareDailyCard} className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-900 font-bold px-4 py-3.5 rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/20">
                            <Share2 className="w-4 h-4" /> Exportar para Redes
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
