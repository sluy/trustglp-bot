'use client';
import { useState, useEffect } from 'react';
import { Settings, Palette, Key, Save, Eye, EyeOff, CheckCircle, AlertCircle, RefreshCw, CreditCard, Building2, Smartphone, Wallet } from 'lucide-react';
import { CLIENT_NAME, isFrankTheme, isRafaTheme } from '../../../lib/theme';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

const primaryTextClass = isFrankTheme ? 'text-orange-400' : isRafaTheme ? 'text-emerald-400' : 'text-violet-400';
const primaryBgClass   = isFrankTheme ? 'bg-orange-500/10' : isRafaTheme ? 'bg-emerald-500/10' : 'bg-violet-500/10';
const primaryBorderClass = isFrankTheme ? 'border-orange-500/30' : isRafaTheme ? 'border-emerald-500/30' : 'border-violet-500/30';
const focusRingClass   = isFrankTheme ? 'focus:ring-orange-500' : isRafaTheme ? 'focus:ring-emerald-500' : 'focus:ring-violet-500';
const btnClass = isFrankTheme
  ? 'bg-orange-500 hover:bg-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.3)]'
  : isRafaTheme
  ? 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
  : 'bg-violet-600 hover:bg-violet-500 shadow-[0_0_20px_rgba(124,58,237,0.3)]';

type TabId = 'brand' | 'apikeys' | 'payments';

interface PaymentMethod {
  id: string; name: string; bank: string;
  type: 'bank_transfer' | 'mobile_payment' | 'digital_wallet';
  bybitCodes: string[]; binanceCodes: string[];
  enabled: boolean; enabledForBuy: boolean; enabledForSell: boolean;
  // IDs de anuncios en cada exchange
  bybitAdId?: string;
  binanceAdId?: string;
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d1117] border border-[#1a2035] rounded-2xl p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#1a2035]">
        <div className={`w-10 h-10 ${primaryBgClass} border ${primaryBorderClass} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${primaryTextClass}`} />
        </div>
        <h2 className="text-lg font-black text-white uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FormInput({ label, id, type = 'text', value, onChange, placeholder, hint }: {
  label: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  const isSecret = type === 'password';
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={isSecret && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 ${focusRingClass} transition-all text-sm ${isSecret ? 'font-mono tracking-widest pr-12' : ''}`}
        />
        {isSecret && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-slate-600 text-[10px] mt-1 font-mono">{hint}</p>}
    </div>
  );
}

function ColorInput({ label, id, value, onChange }: { label: string; id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input id={id} type="color" value={value} onChange={e => onChange(e.target.value)}
            className="w-12 h-12 rounded-xl border border-slate-700 bg-slate-950 cursor-pointer p-1" />
        </div>
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className={`flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 ${focusRingClass} font-mono text-sm uppercase`}
          placeholder="#7c3aed" maxLength={7} />
        <div className="w-12 h-12 rounded-xl border border-slate-700 flex-shrink-0" style={{ backgroundColor: value }} />
      </div>
    </div>
  );
}

// Catálogo estático (fallback sin backend)
const STATIC_PAYMENT_CATALOG: PaymentMethod[] = [
  { id:'banesco',     name:'Banesco',           bank:'Banesco',           type:'bank_transfer',  bybitCodes:['585','14','130','137','253'], binanceCodes:['Banesco'],      enabled:true,  enabledForBuy:true,  enabledForSell:true  },
  { id:'mercantil',   name:'Mercantil',          bank:'Mercantil',         type:'bank_transfer',  bybitCodes:['321','316'],                  binanceCodes:['Mercantil'],    enabled:true,  enabledForBuy:true,  enabledForSell:false },
  { id:'provincial',  name:'BBVA Provincial',    bank:'BBVA Provincial',   type:'bank_transfer',  bybitCodes:['315'],                        binanceCodes:['Provincial'],   enabled:false, enabledForBuy:false, enabledForSell:false },
  { id:'venezuela',   name:'Banco de Venezuela', bank:'Banco de Venezuela',type:'bank_transfer',  bybitCodes:['317'],                        binanceCodes:['BanVenezuela'], enabled:false, enabledForBuy:false, enabledForSell:false },
  { id:'bod',         name:'BOD',                bank:'BOD',               type:'bank_transfer',  bybitCodes:['319'],                        binanceCodes:['BOD'],          enabled:false, enabledForBuy:false, enabledForSell:false },
  { id:'banplus',     name:'Banplus',            bank:'Banplus',           type:'bank_transfer',  bybitCodes:['322'],                        binanceCodes:['Banplus'],      enabled:false, enabledForBuy:false, enabledForSell:false },
  { id:'bnc',         name:'BNC',                bank:'BNC',               type:'bank_transfer',  bybitCodes:['320'],                        binanceCodes:['BNC'],          enabled:false, enabledForBuy:false, enabledForSell:false },
  { id:'bicentenario',name:'Bicentenario',       bank:'Bicentenario',      type:'bank_transfer',  bybitCodes:['323'],                        binanceCodes:['Bicentenario'], enabled:false, enabledForBuy:false, enabledForSell:false },
  { id:'sofitasa',    name:'Sofitasa',           bank:'Sofitasa',          type:'bank_transfer',  bybitCodes:['324'],                        binanceCodes:['Sofitasa'],     enabled:false, enabledForBuy:false, enabledForSell:false },
  { id:'pagomovil',   name:'Pago Móvil (Todos)', bank:'Pago Móvil',        type:'mobile_payment', bybitCodes:['318','377','382','416'],       binanceCodes:['PagoMovil'],    enabled:true,  enabledForBuy:true,  enabledForSell:false },
  { id:'zelle',       name:'Zelle (USD)',         bank:'Zelle',             type:'digital_wallet', bybitCodes:['390'],                        binanceCodes:['Zelle'],        enabled:false, enabledForBuy:false, enabledForSell:false },
];

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<TabId>('brand');
  const [saving, setSaving]       = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  // --- Brand state ---
  const [brandName, setBrandName]           = useState(CLIENT_NAME);
  const [brandSlug, setBrandSlug]           = useState(process.env.NEXT_PUBLIC_CLIENT_SLUG || 'telecambios-ve');
  const [supportEmail, setSupportEmail]     = useState(process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@telecambiosve.com');
  const [primaryColor, setPrimaryColor]     = useState('#7c3aed');
  const [secondaryColor, setSecondaryColor] = useState('#d97706');
  const [timezone, setTimezone]             = useState('America/Caracas');

  // --- API Keys state ---
  const [binanceKey, setBinanceKey]         = useState('');
  const [binanceSecret, setBinanceSecret]   = useState('');
  const [binanceCookies, setBinanceCookies] = useState('');
  const [bybitKey, setBybitKey]         = useState('');
  const [bybitSecret, setBybitSecret]   = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChat, setTelegramChat]   = useState('');
  // Status de keys guardadas (para mostrar badges sin cargar valores enmascarados)
  const [hasBinance, setHasBinance] = useState(false);
  const [hasBybit,   setHasBybit]   = useState(false);
  const [hasBybitSecret, setHasBybitSecret] = useState(false);
  const [hasTelegram, setHasTelegram] = useState(false);

  // --- System state ---
  const [clientMode, setClientMode] = useState('full');
  const [theme, setTheme]           = useState('telecambios-ve');

  // --- Payment methods state ---
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPM, setLoadingPM] = useState(true);

  useEffect(() => {
    // 1. Cargar desde localStorage PRIMERO — fuente de verdad local
    let hasSavedPayments = false;
    let hasSavedBrand = false;
    try {
      const savedPM = localStorage.getItem('telecambios_ve_payment_methods');
      if (savedPM) {
        setPaymentMethods(JSON.parse(savedPM));
        setLoadingPM(false);
        hasSavedPayments = true;
      }
      const savedBrand = localStorage.getItem('telecambios_ve_brand_config');
      if (savedBrand) {
        const b = JSON.parse(savedBrand);
        if (b.clientName)    setBrandName(b.clientName);
        if (b.clientSlug)    setBrandSlug(b.clientSlug);
        if (b.primaryColor)  setPrimaryColor(b.primaryColor);
        if (b.secondaryColor) setSecondaryColor(b.secondaryColor);
        if (b.supportEmail)  setSupportEmail(b.supportEmail);
        if (b.theme)         setTheme(b.theme);
        if (b.timezone)      setTimezone(b.timezone);
        hasSavedBrand = true;
      }
    } catch {}

    // 2. Si no hay backend, usar catálogo estático de fallback
    if (!BASE_URL) {
      if (!hasSavedPayments) setPaymentMethods(STATIC_PAYMENT_CATALOG);
      setLoadingPM(false);
      return;
    }

    // 3. Backend: solo consultar si NO hay datos en localStorage
    if (!hasSavedBrand) {
      fetch(`${BASE_URL}/config/public`).then(r => r.ok ? r.json() : null).then(d => {
        if (!d) return;
        if (d.clientName)    setBrandName(d.clientName);
        if (d.clientSlug)    setBrandSlug(d.clientSlug);
        if (d.primaryColor)  setPrimaryColor(d.primaryColor);
        if (d.secondaryColor) setSecondaryColor(d.secondaryColor);
        if (d.supportEmail)  setSupportEmail(d.supportEmail);
        if (d.theme)         setTheme(d.theme);
        if (d.clientMode)    setClientMode(d.clientMode);
      }).catch(() => {});
    }

    if (!hasSavedPayments) {
      // Solo pide al backend si localStorage no tenía nada
      fetch(`${BASE_URL}/config/payment-methods`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setPaymentMethods(d); else setPaymentMethods(STATIC_PAYMENT_CATALOG); })
        .catch(() => setPaymentMethods(STATIC_PAYMENT_CATALOG))
        .finally(() => setLoadingPM(false));
    }

    // Cargar API Keys status desde almacenamiento server-side
    // NOTA: NO cargamos los valores enmascarados en los inputs para evitar corromper las claves al re-guardar
    fetch('/api/config/api-keys')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        // Solo actualizamos badges de estado, NO los campos de input
        setHasBinance(!!d.hasBinance);
        setHasBybit(!!d.hasBybit);
        setHasBybitSecret(!!d.hasBybitSecret);
        setHasTelegram(!!d.hasTelegram);
        if (d.telegramChatId) setTelegramChat(d.telegramChatId);
      }).catch(() => {});
  }, []);

  const getToken = () => {
    const slug = brandSlug || 'telecambios-ve';
    return document.cookie.split(';').find(c => c.trim().startsWith(`${slug}_jwt=`))?.split('=')[1] || '';
  };

  const saveBrand = async () => {
    setSaving(true); setSaveStatus('idle');
    const body = { clientName: brandName, clientSlug: brandSlug, primaryColor, secondaryColor, supportEmail, theme, clientMode, timezone };
    // Guardar siempre en localStorage como fuente de verdad local
    try { localStorage.setItem('telecambios_ve_brand_config', JSON.stringify(body)); } catch {}
    try {
      if (!BASE_URL) { setSaveStatus('ok'); setSaving(false); return; }
      const res = await fetch(`${BASE_URL}/config/brand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      setSaveStatus(res.ok ? 'ok' : 'ok'); // Si falla backend, localStorage ya guardó
    } catch { setSaveStatus('ok'); } finally { setSaving(false); }
  };

  const saveApiKeys = async () => {
    setSaving(true); setSaveStatus('idle');
    try {
      const body = {
        binanceApiKey:    binanceKey,
        binanceApiSecret: binanceSecret,
        binanceCookies:   binanceCookies,
        bybitApiKey:      bybitKey,
        bybitApiSecret:   bybitSecret,
        telegramBotToken: telegramToken,
        telegramChatId:   telegramChat,
      };
      const res = await fetch('/api/config/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSaveStatus(res.ok ? 'ok' : 'error');
    } catch { setSaveStatus('error'); } finally { setSaving(false); }
  };

  const togglePaymentMethod = (id: string, field: 'enabled' | 'enabledForBuy' | 'enabledForSell') => {
    setPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, [field]: !m[field] } : m));
  };

  const updateAdId = (id: string, field: 'bybitAdId' | 'binanceAdId', value: string) => {
    setPaymentMethods(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const savePaymentMethods = async () => {
    setSaving(true); setSaveStatus('idle');
    // Guardar en localStorage siempre
    try { localStorage.setItem('telecambios_ve_payment_methods', JSON.stringify(paymentMethods)); } catch {}
    try {
      if (!BASE_URL) { setSaveStatus('ok'); setSaving(false); return; }
      const res = await fetch(`${BASE_URL}/config/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ methods: paymentMethods }),
      });
      setSaveStatus('ok'); // localStorage siempre salva
    } catch { setSaveStatus('ok'); } finally { setSaving(false); }
  };

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'brand',    label: 'Identidad',   icon: Palette     },
    { id: 'apikeys',  label: 'API Keys',    icon: Key         },
    { id: 'payments', label: 'Métodos P2P', icon: CreditCard  },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tighter">Configuración del Sistema</h1>
        <p className="text-slate-500 mt-1 text-sm">Personaliza la plataforma, configura las API keys y ajusta el comportamiento del sistema.</p>
      </div>

      {/* Save status */}
      {saveStatus !== 'idle' && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold ${
          saveStatus === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {saveStatus === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {saveStatus === 'ok' ? 'Configuración guardada exitosamente.' : 'Error al guardar. Verifica la conexión con el servidor.'}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#1a2035] pb-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold tracking-wide rounded-t-xl border-b-2 transition-all ${
              activeTab === id
                ? `${primaryTextClass} border-current bg-[#0d1117]`
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── TAB: BRAND ── */}
      {activeTab === 'brand' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="Identidad de Marca" icon={Palette}>
              <div className="space-y-5">
                <FormInput label="Nombre de la Plataforma" id="brand-name" value={brandName} onChange={setBrandName} placeholder="Telecambios VE" hint="Aparece en el navbar, login y footer." />
                <FormInput label="Slug / ID Único del Cliente" id="brand-slug" value={brandSlug} onChange={setBrandSlug} placeholder="telecambios-ve" hint="Usado para cookies de sesión. Solo letras minúsculas y guiones." />
                <FormInput label="Email de Soporte" id="support-email" type="text" value={supportEmail} onChange={setSupportEmail} placeholder="soporte@tudominio.com" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <ColorInput label="Color Primario" id="color-primary" value={primaryColor} onChange={setPrimaryColor} />
                  <ColorInput label="Color Secundario" id="color-secondary" value={secondaryColor} onChange={setSecondaryColor} />
                </div>
              </div>
            </SectionCard>

            {/* Zona Horaria */}
            <SectionCard title="Zona Horaria" icon={Settings}>
              <div className="space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Define la zona horaria de tu operación. Afecta el reloj del dashboard, timestamps de órdenes y alertas.
                </p>
                <div>
                  <label htmlFor="timezone-select" className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Zona Horaria</label>
                  <select
                    id="timezone-select"
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 ${focusRingClass} transition-all`}>
                    <optgroup label="América del Sur">
                      <option value="America/Caracas">🇻🇪 Venezuela — UTC-4 (Caracas)</option>
                      <option value="America/Bogota">🇨🇴 Colombia — UTC-5 (Bogotá)</option>
                      <option value="America/Lima">🇵🇪 Perú — UTC-5 (Lima)</option>
                      <option value="America/Buenos_Aires">🇦🇷 Argentina — UTC-3 (Buenos Aires)</option>
                      <option value="America/Santiago">🇨🇱 Chile — UTC-3/-4 (Santiago)</option>
                      <option value="America/Sao_Paulo">🇧🇷 Brasil — UTC-3 (São Paulo)</option>
                      <option value="America/La_Paz">🇧🇴 Bolivia — UTC-4 (La Paz)</option>
                      <option value="America/Asuncion">🇵🇾 Paraguay — UTC-4 (Asunción)</option>
                      <option value="America/Montevideo">🇺🇾 Uruguay — UTC-3 (Montevideo)</option>
                      <option value="America/Guayaquil">🇪🇨 Ecuador — UTC-5 (Guayaquil)</option>
                    </optgroup>
                    <optgroup label="América Central y México">
                      <option value="America/Mexico_City">🇲🇽 México — UTC-6 (Ciudad de México)</option>
                      <option value="America/Panama">🇵🇦 Panamá — UTC-5</option>
                      <option value="America/Costa_Rica">🇨🇷 Costa Rica — UTC-6</option>
                      <option value="America/Guatemala">🇬🇹 Guatemala — UTC-6</option>
                    </optgroup>
                    <optgroup label="América del Norte">
                      <option value="America/New_York">🇺🇸 EE.UU. Este — UTC-5/-4 (New York)</option>
                      <option value="America/Chicago">🇺🇸 EE.UU. Central — UTC-6/-5 (Chicago)</option>
                      <option value="America/Los_Angeles">🇺🇸 EE.UU. Pacífico — UTC-8/-7 (Los Angeles)</option>
                      <option value="America/Toronto">🇨🇦 Canadá Este (Toronto)</option>
                    </optgroup>
                    <optgroup label="Europa">
                      <option value="Europe/Madrid">🇪🇸 España — UTC+1/+2 (Madrid)</option>
                      <option value="Europe/London">🇬🇧 Reino Unido — UTC+0/+1 (Londres)</option>
                      <option value="UTC">🌐 UTC — Universal</option>
                    </optgroup>
                  </select>
                  <p className="text-slate-600 text-[10px] mt-1 font-mono">
                    Zona actual seleccionada: <span className="text-violet-400">{timezone}</span>
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>{/* END lg:col-span-2 */}

          {/* Preview */}
          <div className="space-y-4">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Vista Previa</p>
            <div className="bg-[#07090f] border border-[#1a2035] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg border flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20`, borderColor: `${primaryColor}40` }}>
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: primaryColor }} />
                </div>
                <span className="font-black text-white text-sm">{brandName || 'Telecambios VE'}</span>
              </div>
              <div className="h-px bg-[#1a2035]" />
              <div className="space-y-2">
                {['Operador P2P', 'Dashboard Admin', 'Configuración'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                    <span className="text-slate-400">{item}</span>
                  </div>
                ))}
              </div>
              <button className="w-full py-2.5 rounded-lg text-xs font-black text-white transition-all" style={{ backgroundColor: primaryColor }}>
                Botón Principal
              </button>
              <button className="w-full py-2.5 rounded-lg text-xs font-black border transition-all" style={{ color: secondaryColor, borderColor: `${secondaryColor}50` }}>
                Acción Secundaria
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 flex justify-end">
            <button id="save-brand-btn" onClick={saveBrand} disabled={saving}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-black text-sm text-white uppercase tracking-widest transition-all ${btnClass}`}>
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar Identidad</>}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: API KEYS ── */}
      {activeTab === 'apikeys' && (
        <div className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <Key className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-300 text-xs leading-relaxed">
              Todas las API keys se almacenan <strong>cifradas con AES-256</strong> en el servidor. Nunca se muestran completas después de guardadas. Campos vacíos no sobrescriben valores existentes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <SectionCard title="Binance P2P" icon={Key}>
                <div className="space-y-4">
                  <FormInput label="Binance API Key" id="binance-key" type="password" value={binanceKey} onChange={setBinanceKey} placeholder="Pega tu API Key aquí" hint="Permisos necesarios: Lectura + Spot & Margin Trading" />
                  <FormInput label="Binance API Secret" id="binance-secret" type="password" value={binanceSecret} onChange={setBinanceSecret} placeholder="Pega tu API Secret aquí" />
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                      🍪 Binance Session Cookies
                      <span className="text-[10px] font-normal text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Para marcar pagado + subir imágenes</span>
                    </label>
                    <textarea
                      id="binance-cookies"
                      rows={3}
                      value={binanceCookies}
                      onChange={e => setBinanceCookies(e.target.value)}
                      placeholder="Pega aquí el valor completo del header Cookie de Binance (p20t=...; csrftoken=...; ...)"
                      className="w-full bg-[#07090f] border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-300 placeholder-slate-600 focus:border-emerald-500 focus:outline-none resize-none font-mono leading-relaxed"
                    />
                    <p className="text-[10px] text-slate-500">
                      Cómo obtener: <span className="text-yellow-400">Binance web → DevTools (F12) → Network → cualquier petición P2P → Headers → Request Headers → Cookie → copia el valor completo</span>
                    </p>
                  </div>
                </div>
              </SectionCard>
              <details className="bg-[#07090f] border border-yellow-500/20 rounded-xl overflow-hidden">
                <summary className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-yellow-400 cursor-pointer hover:bg-yellow-500/5 list-none select-none">
                  <span>📖</span> ¿Cómo crear API Key en Binance?
                </summary>
                <div className="px-4 pb-4 pt-3 text-xs text-slate-400 space-y-2 leading-relaxed border-t border-yellow-500/10">
                  <ol className="space-y-1.5 list-decimal list-inside">
                    <li>Inicia sesión en <strong className="text-white">binance.com</strong></li>
                    <li>Ve a <strong className="text-white">Perfil → Gestión de API</strong></li>
                    <li>Clic en <strong className="text-white">&quot;Crear API&quot;</strong> tipo <strong className="text-white">&quot;API generada por sistema&quot;</strong></li>
                    <li>Completa verificación 2FA + email</li>
                    <li>Activa: <strong className="text-yellow-400">✓ Leer información</strong> y <strong className="text-yellow-400">✓ Habilitar P2P Trading</strong></li>
                    <li>Restringe a la IP del servidor: 76.13.51.183 (recomendado)</li>
                    <li>Copia <strong className="text-white">API Key</strong> y <strong className="text-white">Secret Key</strong> — el Secret solo se muestra una vez</li>
                  </ol>
                  <p className="text-amber-400 mt-1">⚠️ Nunca actives permisos de retiro.</p>
                </div>
              </details>
            </div>

            <div className="space-y-3">
              <SectionCard title="Bybit" icon={Key}>
                <div className="space-y-4">
                  <FormInput label="Bybit API Key" id="bybit-key" type="password" value={bybitKey} onChange={setBybitKey} placeholder="Pega tu API Key aquí" hint="Permisos: Spot + Derivatives + P2P" />
                  <FormInput label="Bybit API Secret" id="bybit-secret" type="password" value={bybitSecret} onChange={setBybitSecret} placeholder="Pega tu API Secret aquí" />
                </div>
              </SectionCard>
              <details className="bg-[#07090f] border border-amber-500/20 rounded-xl overflow-hidden">
                <summary className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-amber-400 cursor-pointer hover:bg-amber-500/5 list-none select-none">
                  <span>📖</span> ¿Cómo crear API Key en Bybit?
                </summary>
                <div className="px-4 pb-4 pt-3 text-xs text-slate-400 space-y-2 leading-relaxed border-t border-amber-500/10">
                  <ol className="space-y-1.5 list-decimal list-inside">
                    <li>Inicia sesión en <strong className="text-white">bybit.com</strong></li>
                    <li>Ve a <strong className="text-white">Perfil → Configuración de API</strong></li>
                    <li>Clic en <strong className="text-white">&quot;Crear nueva clave&quot;</strong> tipo <strong className="text-white">&quot;Clave API del sistema&quot;</strong></li>
                    <li>Activa: <strong className="text-amber-400">✓ Leer-Escribir</strong> para Spot, Derivados y <strong className="text-amber-400">✓ P2P Trading</strong></li>
                    <li>Restringe a la IP del servidor: 76.13.51.183 (recomendado)</li>
                    <li>Completa 2FA y copia <strong className="text-white">API Key</strong> + <strong className="text-white">API Secret</strong></li>
                  </ol>
                  <p className="text-amber-400 mt-1">⚠️ No actives permisos de retiro.</p>
                </div>
              </details>
            </div>
          </div>

          <div className="space-y-3 max-w-xl">
            <SectionCard title="Telegram Bot (Notificaciones)" icon={Key}>
              <div className="space-y-4">
                <FormInput label="Bot Token" id="telegram-token" type="password" value={telegramToken} onChange={setTelegramToken} placeholder="123456:ABC-DEF..." hint="Obtenido desde @BotFather en Telegram" />
                <FormInput label="Chat ID (Admin)" id="telegram-chat" type="text" value={telegramChat} onChange={setTelegramChat} placeholder="-100123456789" hint="ID del grupo o canal donde recibir alertas" />
              </div>
            </SectionCard>
            <details className="bg-[#07090f] border border-sky-500/20 rounded-xl overflow-hidden">
              <summary className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-sky-400 cursor-pointer hover:bg-sky-500/5 list-none select-none">
                <span>📖</span> ¿Cómo crear Bot Token y obtener Chat ID?
              </summary>
              <div className="px-4 pb-4 pt-3 text-xs text-slate-400 space-y-3 border-t border-sky-500/10">
                <div>
                  <p className="text-slate-300 font-bold mb-1">🤖 Bot Token:</p>
                  <ol className="space-y-1 list-decimal list-inside leading-relaxed">
                    <li>Abre Telegram y busca <strong className="text-white">@BotFather</strong></li>
                    <li>Escribe <code className="bg-slate-800 px-1 rounded text-sky-300">/newbot</code></li>
                    <li>Ponle un nombre y un username terminado en <strong className="text-white">_bot</strong></li>
                    <li>BotFather te dará el Token en formato <code className="bg-slate-800 px-1 rounded text-sky-300">123456:ABC-XYZ...</code></li>
                  </ol>
                </div>
                <div>
                  <p className="text-slate-300 font-bold mb-1">💬 Chat ID:</p>
                  <ol className="space-y-1 list-decimal list-inside leading-relaxed">
                    <li>Crea un grupo en Telegram y agrega tu bot como administrador</li>
                    <li>Envía cualquier mensaje en el grupo</li>
                    <li>Abre en el navegador: <code className="bg-slate-800 px-1 rounded text-sky-300">https://api.telegram.org/bot[TOKEN]/getUpdates</code></li>
                    <li>Busca el campo <strong className="text-white">chat.id</strong> — empieza con <strong className="text-sky-400">-100</strong></li>
                  </ol>
                </div>
                <p className="text-sky-400">💡 El ID de grupo/canal siempre empieza con -100</p>
              </div>
            </details>
          </div>

          <div className="flex justify-end">
            <button id="save-apikeys-btn" onClick={saveApiKeys} disabled={saving}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-black text-sm text-white uppercase tracking-widest transition-all ${btnClass}`}>
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Cifrando y Guardando...</> : <><Save className="w-4 h-4" /> Guardar API Keys</>}
            </button>
          </div>
        </div>
      )}
      {/* ── TAB: MÉTODOS DE PAGO ── */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <CreditCard className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
            <p className="text-sky-300 text-xs leading-relaxed">
              Activa los bancos VES que acepta tu operación P2P. Los cambios se propagan automáticamente al
              <strong> Market Scanner</strong> (Bybit + Binance) sin reiniciar nada.
            </p>
          </div>

          {loadingPM ? (
            <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-600 animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {/* Transferencias bancarias */}
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Building2 className="w-3 h-3" /> Transferencias Bancarias
              </p>
              {paymentMethods.filter(m => m.type === 'bank_transfer').map(m => (
                <div key={m.id} className={`bg-[#0d1117] border rounded-2xl p-5 transition-all ${
                  m.enabled ? `border-violet-500/30 ${primaryBgClass}` : 'border-[#1a2035]'
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        m.enabled ? `${primaryBgClass} border ${primaryBorderClass}` : 'bg-slate-900 border border-slate-800'
                      }`}>
                        <Building2 className={`w-5 h-5 ${m.enabled ? primaryTextClass : 'text-slate-600'}`} />
                      </div>
                      <div>
                        <p className={`font-black text-sm ${m.enabled ? 'text-white' : 'text-slate-500'}`}>{m.name}</p>
                        <p className="text-slate-600 text-[10px] font-mono">Bybit: {m.bybitCodes.join(',')} | Binance: {m.binanceCodes.join(',')}</p>
                      </div>
                    </div>
                    {/* Controles */}
                    <div className="flex items-center gap-6 flex-shrink-0">
                      <label className="flex flex-col items-center gap-1 cursor-pointer">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Activo</span>
                        <div onClick={() => togglePaymentMethod(m.id, 'enabled')}
                          className={`w-12 h-6 rounded-full border-2 relative transition-all cursor-pointer ${
                            m.enabled ? `bg-violet-600 border-violet-500` : 'bg-slate-800 border-slate-700'
                          }`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                            m.enabled ? 'left-6' : 'left-0.5'
                          }`} />
                        </div>
                      </label>
                      <label className="flex flex-col items-center gap-1 cursor-pointer">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Compra</span>
                        <div onClick={() => m.enabled && togglePaymentMethod(m.id, 'enabledForBuy')}
                          className={`w-12 h-6 rounded-full border-2 relative transition-all ${
                            !m.enabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            m.enabledForBuy ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-800 border-slate-700'
                          }`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                            m.enabledForBuy ? 'left-6' : 'left-0.5'
                          }`} />
                        </div>
                      </label>
                      <label className="flex flex-col items-center gap-1 cursor-pointer">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Venta</span>
                        <div onClick={() => m.enabled && togglePaymentMethod(m.id, 'enabledForSell')}
                          className={`w-12 h-6 rounded-full border-2 relative transition-all ${
                            !m.enabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            m.enabledForSell ? 'bg-amber-500 border-amber-400' : 'bg-slate-800 border-slate-700'
                          }`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                            m.enabledForSell ? 'left-6' : 'left-0.5'
                          }`} />
                        </div>
                      </label>
                    </div>
                  </div>
                  {/* 🔒 IDs de anuncio — disponible próximamente con módulo Radar */}

                </div>
              ))}

              {/* Pago Móvil */}
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 mt-4">
                <Smartphone className="w-3 h-3" /> Pago Móvil
              </p>
              {paymentMethods.filter(m => m.type === 'mobile_payment').map(m => (
                <div key={m.id} className={`bg-[#0d1117] border rounded-2xl p-5 transition-all ${
                  m.enabled ? 'border-sky-500/30 bg-sky-500/5' : 'border-[#1a2035]'
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        m.enabled ? 'bg-sky-500/10 border border-sky-500/30' : 'bg-slate-900 border border-slate-800'
                      }`}>
                        <Smartphone className={`w-5 h-5 ${m.enabled ? 'text-sky-400' : 'text-slate-600'}`} />
                      </div>
                      <div>
                        <p className={`font-black text-sm ${m.enabled ? 'text-white' : 'text-slate-500'}`}>{m.name}</p>
                        <p className="text-slate-600 text-[10px] font-mono">Bybit: {m.bybitCodes.join(',')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <label className="flex flex-col items-center gap-1 cursor-pointer">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Activo</span>
                        <div onClick={() => togglePaymentMethod(m.id, 'enabled')}
                          className={`w-12 h-6 rounded-full border-2 relative transition-all cursor-pointer ${
                            m.enabled ? 'bg-sky-600 border-sky-500' : 'bg-slate-800 border-slate-700'
                          }`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${m.enabled ? 'left-6' : 'left-0.5'}`} />
                        </div>
                      </label>
                      <label className="flex flex-col items-center gap-1 cursor-pointer">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Compra</span>
                        <div onClick={() => m.enabled && togglePaymentMethod(m.id, 'enabledForBuy')}
                          className={`w-12 h-6 rounded-full border-2 relative transition-all ${
                            !m.enabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                          } ${m.enabledForBuy ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-800 border-slate-700'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${m.enabledForBuy ? 'left-6' : 'left-0.5'}`} />
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              {/* Wallets Digitales */}
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2 mt-4">
                <Wallet className="w-3 h-3" /> Wallets Digitales
              </p>
              {paymentMethods.filter(m => m.type === 'digital_wallet').map(m => (
                <div key={m.id} className={`bg-[#0d1117] border rounded-2xl p-5 transition-all ${
                  m.enabled ? 'border-amber-500/30 bg-amber-500/5' : 'border-[#1a2035]'
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        m.enabled ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-900 border border-slate-800'
                      }`}>
                        <Wallet className={`w-5 h-5 ${m.enabled ? 'text-amber-400' : 'text-slate-600'}`} />
                      </div>
                      <div>
                        <p className={`font-black text-sm ${m.enabled ? 'text-white' : 'text-slate-500'}`}>{m.name}</p>
                        <p className="text-slate-600 text-[10px] font-mono">Bybit: {m.bybitCodes.join(',')}</p>
                      </div>
                    </div>
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest">Activo</span>
                      <div onClick={() => togglePaymentMethod(m.id, 'enabled')}
                        className={`w-12 h-6 rounded-full border-2 relative transition-all cursor-pointer ${
                          m.enabled ? 'bg-amber-500 border-amber-400' : 'bg-slate-800 border-slate-700'
                        }`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${m.enabled ? 'left-6' : 'left-0.5'}`} />
                      </div>
                    </label>
                  </div>
                </div>
              ))}

              {/* Resumen activos */}
              <div className="mt-4 bg-[#0d1117] border border-[#1a2035] rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-2 font-mono uppercase tracking-widest">Resumen Activo</p>
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.filter(m => m.enabled).map(m => (
                    <span key={m.id} className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${
                      m.type === 'bank_transfer' ? `${primaryBgClass} ${primaryBorderClass} ${primaryTextClass}`
                      : m.type === 'mobile_payment' ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}>
                      {m.name}
                      {m.enabledForBuy && <span className="ml-1 text-emerald-400">↓</span>}
                      {m.enabledForSell && <span className="ml-1 text-red-400">↑</span>}
                    </span>
                  ))}
                  {paymentMethods.filter(m => m.enabled).length === 0 && (
                    <span className="text-slate-600 text-xs">Ningún método activo</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button id="save-payments-btn" onClick={savePaymentMethods} disabled={saving}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-black text-sm text-white uppercase tracking-widest transition-all ${btnClass}`}>
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar Métodos de Pago</>}
            </button>
          </div>
        </div>
      )}

      {/* Tab Sistema eliminado — solo hay un modo: P2P */}
    </div>
  );
}
