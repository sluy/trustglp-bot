import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DATA_DIR  = '/app/data';
const KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');

function readKeys(): Record<string, string> {
  try {
    if (!existsSync(KEYS_FILE)) return {};
    return JSON.parse(readFileSync(KEYS_FILE, 'utf-8'));
  } catch { return {}; }
}

function isMasked(s: string | undefined): boolean {
  return !s || s.includes('·') || s === '***' || s.length < 8;
}

function signBybit(apiKey: string, apiSecret: string, body: string) {
  const timestamp  = Date.now().toString();
  const recvWindow = '5000';
  const preSign    = timestamp + apiKey + recvWindow + body;
  const sign       = crypto.createHmac('sha256', apiSecret).update(preSign).digest('hex');
  return { timestamp, recvWindow, sign };
}

async function callBybitPage(apiKey: string, apiSecret: string, page: number): Promise<any> {
  const bodyObj = { page, size: 10 };
  const bodyStr = JSON.stringify(bodyObj);
  const { timestamp, recvWindow, sign } = signBybit(apiKey, apiSecret, bodyStr);

  const res = await fetch('https://api.bybit.com/v5/p2p/order/simplifyList', {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'X-BAPI-API-KEY':     apiKey,
      'X-BAPI-TIMESTAMP':   timestamp,
      'X-BAPI-SIGN':        sign,
      'X-BAPI-SIGN-TYPE':   '2',      // CRÍTICO para P2P API
      'X-BAPI-RECV-WINDOW': recvWindow,
    },
    body: bodyStr,
    cache: 'no-store',
  });

  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { throw new Error(`Bybit no-JSON: ${text.slice(0, 200)}`); }
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS MAP: Bybit P2P simplifyList endpoint
// VERIFICADO EN PRODUCCIÓN vs UI de Bybit 2026-05-14:
//
// status 10 = PENDIENTE DE PAGO (buyer NO ha pagado aún → naranja)
// status 20 = PAGO RECIBIDO / En proceso (buyer pagó, esperando liberación → azul)
// status 30 = COMPLETADA (liberada) → verde
// status 40 = CANCELADA → gris
// status 50 = EN DISPUTA → rojo
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; active: boolean }> = {
  '10': { label: 'PENDIENTE DE PAGO',   color: 'orange', active: true  },
  '20': { label: 'PAGO RECIBIDO',        color: 'blue',   active: true  },
  '30': { label: 'COMPLETADA',           color: 'green',  active: false },
  '40': { label: 'CANCELADA',            color: 'gray',   active: false },
  '50': { label: 'EN DISPUTA',           color: 'red',    active: true  },
  '60': { label: 'COMPLETADA',           color: 'green',  active: false },
};

// Códigos de pago Bybit → nombre legible
// Fuente: plataforma Bybit P2P Venezuela (verificado con anuncios reales)
const BYBIT_PAYMENT_CODES: Record<string, string> = {
  '14':  'Banesco',
  '16':  'Banesco (Oficial)',
  '130': 'Banesco',
  '137': 'Banesco (Oficial)',
  '253': 'Banesco',
  '316': 'Mercantil',
  '321': 'Mercantil (Oficial)',
  '317': 'Banco de Venezuela',
  '302': 'BDV',
  '319': 'BOD',
  '320': 'BNC',
  '322': 'Banplus',
  '323': 'Bicentenario',
  '324': 'Sofitasa',
  '318': 'Pago Móvil',
  '377': 'Pago Móvil (Banesco)',
  '382': 'Pago Móvil (Mercantil)',
  '416': 'Pago Móvil (BDV)',
  '390': 'Zelle',
  '585': 'Banesco (VES)',
  '315': 'BBVA Provincial',
};

function resolvePaymentNames(payments: any): string {
  // simplifyList devuelve payments como array de strings con códigos numéricos
  // Ejemplo: ["130", "316"] o ["137"]
  if (Array.isArray(payments) && payments.length > 0) {
    const names = payments
      .map((p: any) => {
        // A veces viene como objeto {payMethodName, paymentId}, a veces como string
        if (typeof p === 'object' && p !== null) {
          return p.payMethodName ?? p.payTypeName ?? BYBIT_PAYMENT_CODES[String(p.id ?? p.paymentId ?? '')] ?? String(p.id ?? '');
        }
        const code = String(p);
        return BYBIT_PAYMENT_CODES[code] ?? `Banco ${code}`;
      })
      .filter(Boolean);
    // Deduplicar nombres iguales (ej: Banesco + Banesco)
    return [...new Set(names)].join(' / ');
  }
  // También puede venir como string directamente
  if (typeof payments === 'string' && payments) {
    return BYBIT_PAYMENT_CODES[payments] ?? payments;
  }
  return '—';
}

// Mapeo exacto de campos Bybit simplifyList (verificado en producción 2026-05-14)
function normalizeOrder(item: any) {
  const statusStr  = String(item.status ?? item.orderStatus ?? '');
  const statusInfo = STATUS_MAP[statusStr] ?? { label: statusStr || 'DESCONOCIDO', color: 'gray', active: false };

  // side: 0 = BUY (nosotros compramos USDT pagando VES al vendedor)
  //       1 = SELL (vendemos USDT recibiendo VES)
  const side = (item.side === 0 || item.side === '0') ? 'BUY' : 'SELL';

  // payment method: simplifyList usa el campo "payments" (array de strings/códigos)
  // NO usa paymentType como el endpoint de anuncios
  const paymentMethod = resolvePaymentNames(item.payments ?? item.paymentType ?? item.payMethod);

  // ── Montos ──────────────────────────────────────────────────────────────
  // En simplifyList:
  //   item.price    = precio por USDT en VES (ej: "630.000")
  //   item.quantity = cantidad USDT comprada  (ej: "1.0000")
  //   item.amount   = precio del anuncio (no útil para órdenes específicas)
  //
  // El monto total en VES = price × quantity
  // Ejemplo: 630.000 × 1.0000 = 630,000 VES
  const price    = parseFloat(item.price    ?? '0');
  const quantity = parseFloat(item.notifyTokenQuantity ?? item.quantity ?? '0');
  const amountFiat = price > 0 && quantity > 0 ? (price * quantity).toFixed(3) : (item.amount ?? '—');

  return {
    id:            item.id ?? item.orderId ?? item.orderNo ?? 'N/A',
    bybitOrderId:  item.id ?? item.orderId ?? item.orderNo ?? 'N/A',
    side,
    status:        statusInfo.label,
    statusRaw:     statusStr,
    statusColor:   statusInfo.color,
    tokenId:       item.tokenId    ?? item.notifyTokenId ?? 'USDT',
    currencyId:    item.currencyId ?? 'VES',
    price:         item.price      ?? '—',
    quantity:      item.notifyTokenQuantity ?? item.quantity ?? '—',  // USDT
    amount:        amountFiat,  // VES total = price × quantity
    amountFiat,
    paymentMethod,
    counterparty:  item.targetNickName ?? item.targetNickname ?? item.nickName ?? 'N/A',
    createdAt:     item.createDate
                     ? new Date(Number(item.createDate)).toISOString()
                     : new Date().toISOString(),
    exchange: 'bybit',
  };
}

// Statuses que consideramos "activos" (nuevas órdenes que necesitan atención)
// status 10 = Pendiente de pago, status 20 = Pago recibido/En proceso, status 50 = En disputa
const ACTIVE_STATUSES  = new Set(['10', '20']); // pending payment y paid/processing
const DISPUTE_STATUSES = new Set(['50']);        // disputas (separadas)

export async function GET(req: Request) {
  const keys = readKeys();
  const bybitApiKey    = (keys.bybitApiKey    && !isMasked(keys.bybitApiKey))    ? keys.bybitApiKey    : (process.env.BYBIT_API_KEY    || '');
  const bybitApiSecret = (keys.bybitApiSecret && !isMasked(keys.bybitApiSecret)) ? keys.bybitApiSecret : (process.env.BYBIT_API_SECRET || '');

  if (!bybitApiKey || !bybitApiSecret || isMasked(bybitApiKey) || isMasked(bybitApiSecret)) {
    return NextResponse.json({
      orders: [], error: 'Falta Bybit API Key o Secret. Ve a Config → API Keys.',
      retCode: -1,
    });
  }

  const url = new URL(req.url);
  const includeDisputes = url.searchParams.get('disputes') === 'true';

  try {
    const activeOrders:  any[] = [];
    const disputeOrders: any[] = [];
    let totalFromBybit = 0;

    const MAX_PAGES = 20;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await callBybitPage(bybitApiKey, bybitApiSecret, page);
      const retCode = data.retCode ?? data.ret_code;
      const retMsg  = data.retMsg  ?? data.ret_msg;

      if (retCode !== 0) {
        return NextResponse.json({ orders: [], error: `Bybit ${retCode}: ${retMsg}`, retCode });
      }

      const result = data.result ?? {};
      const items: any[] = result.items ?? result.list ?? result.rows ?? result.data ?? [];
      if (totalFromBybit === 0) {
        totalFromBybit = result.count ?? result.totalCount ?? result.total ?? 0;
      }

      if (items.length === 0) break;

      for (const item of items) {
        const s = String(item.status ?? item.orderStatus ?? '');
        if (ACTIVE_STATUSES.has(s)) {
          activeOrders.push(normalizeOrder(item));
        } else if (includeDisputes && DISPUTE_STATUSES.has(s)) {
          disputeOrders.push(normalizeOrder(item));
        }
      }

      // Parar si la última orden es mayor a 90 días
      const lastItem = items[items.length - 1];
      const lastDate = Number(lastItem?.createDate ?? lastItem?.createTime ?? 0);
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      if (lastDate > 0 && lastDate < ninetyDaysAgo) break;
    }

    return NextResponse.json({
      orders:   activeOrders,
      disputes: disputeOrders,
      total:    totalFromBybit,
      active:   activeOrders.length,
      retCode:  0,
    });
  } catch (e: any) {
    return NextResponse.json({ orders: [], error: e.message, retCode: -2 }, { status: 200 });
  }
}
