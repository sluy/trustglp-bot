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

// Binance SAPI HMAC SHA256 signature — query string based
function signBinance(apiSecret: string, queryString: string): string {
  return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

// Mapeo de status de Binance C2C
const BINANCE_STATUS_MAP: Record<string, { label: string; color: string; active: boolean }> = {
  'PENDING':           { label: 'PENDIENTE DE PAGO', color: 'yellow', active: true  },
  'TRADING':           { label: 'EN PROCESO',         color: 'blue',   active: true  },
  'BUYER_PAYED':       { label: 'PAGO RECIBIDO',      color: 'blue',   active: true  },
  'DISTRIBUTING':      { label: 'DISTRIBUYENDO',      color: 'blue',   active: true  },
  'COMPLETED':         { label: 'COMPLETADA',          color: 'green',  active: false },
  'IN_APPEAL':         { label: 'EN DISPUTA',          color: 'red',    active: true  },
  'CANCELLED':         { label: 'CANCELADA',           color: 'gray',   active: false },
  'CANCELLED_BY_SYSTEM': { label: 'CANCELADA (SYS)',  color: 'gray',   active: false },
};

// Órdenes que requieren atención del operador
const ACTIVE_STATUSES = new Set(['PENDING', 'TRADING', 'BUYER_PAYED', 'DISTRIBUTING']);
const DISPUTE_STATUSES = new Set(['IN_APPEAL']);

function normalizeOrder(item: any): any {
  const statusStr  = item.orderStatus ?? '';
  const statusInfo = BINANCE_STATUS_MAP[statusStr] ?? { label: statusStr, color: 'gray', active: false };

  // tradeType: BUY = nosotros compramos USDT (pagamos fiat al vendedor)
  //            SELL = vendemos USDT (recibimos fiat)
  const side = item.tradeType === 'BUY' ? 'BUY' : 'SELL';

  const payMethod = item.payMethodName || '—';

  return {
    id:            item.orderNumber ?? 'N/A',
    bybitOrderId:  item.orderNumber ?? 'N/A',   // campo unificado para compatibilidad con el dashboard
    binanceOrderId: item.orderNumber ?? 'N/A',
    side,
    status:        statusInfo.label,
    statusRaw:     statusStr,
    statusColor:   statusInfo.color,
    tokenId:       item.asset    ?? 'USDT',
    currencyId:    item.fiat     ?? 'VES',
    price:         item.unitPrice ?? '—',
    quantity:      item.amount   ?? '—',        // Cripto USDT
    amount:        item.totalPrice ?? item.amount ?? '—',  // Fiat VES (totalPrice es el monto fiat en Binance)
    amountFiat:    item.totalPrice ?? item.amount ?? '',   // Para el panel de detalles
    paymentMethod: payMethod,
    counterparty:  item.counterPartNickName ?? 'N/A',
    // KYC / nombre real del comprador (disponible en la API de historial)
    buyerRealName:  item.buyerRealName  || null,
    sellerRealName: item.sellerRealName || null,
    createdAt:     item.createTime
                     ? new Date(Number(item.createTime)).toISOString()
                     : new Date().toISOString(),
    exchange: 'binance',
    // Data extra de Binance
    advNo:     item.advNo ?? '',
    commission: item.commission ?? '0',
  };
}

async function callBinancePage(
  apiKey: string,
  apiSecret: string,
  tradeType: 'BUY' | 'SELL',
  page: number
): Promise<any> {
  const timestamp = Date.now().toString();

  // Binance SAPI: parámetros en query string, NO ordenados
  const params: Record<string, string> = {
    tradeType,
    page: String(page),
    rows: '100',
    timestamp,
  };

  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const signature = signBinance(apiSecret, queryString);
  const url = `https://api.binance.com/sapi/v1/c2c/orderMatch/listUserOrderHistory?${queryString}&signature=${signature}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': apiKey,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { throw new Error(`Binance no-JSON: ${text.slice(0, 300)}`); }
  return json;
}

export async function GET(req: Request) {
  const keys = readKeys();

  // Leer keys del archivo de datos (guardadas desde Admin Config) o env vars
  const binanceApiKey    = (keys.binanceApiKey    && !isMasked(keys.binanceApiKey))    ? keys.binanceApiKey    : (process.env.BINANCE_API_KEY    || '');
  const binanceApiSecret = (keys.binanceApiSecret && !isMasked(keys.binanceApiSecret)) ? keys.binanceApiSecret : (process.env.BINANCE_API_SECRET || '');

  if (!binanceApiKey || !binanceApiSecret || isMasked(binanceApiKey) || isMasked(binanceApiSecret)) {
    return NextResponse.json({
      orders: [],
      error: 'Falta Binance API Key o Secret. Ve a Config → API Keys.',
      retCode: -1,
    });
  }

  const url = new URL(req.url);
  const includeDisputes = url.searchParams.get('disputes') === 'true';

  try {
    const activeOrders:  any[] = [];
    const disputeOrders: any[] = [];

    // Binance no tiene paginación ilimitada, pero usa page+rows
    // Buscamos BUY y SELL por separado porque son endpoints distintos
    for (const tradeType of ['BUY', 'SELL'] as const) {
      for (let page = 1; page <= 5; page++) {
        const data = await callBinancePage(binanceApiKey, binanceApiSecret, tradeType, page);

        // Binance devuelve: { code: "000000", message: "success", data: [...], total: N }
        if (data.code && data.code !== '000000') {
          // Fallo de auth u otro error
          return NextResponse.json({
            orders: [],
            error: `Binance Error ${data.code}: ${data.message}`,
            retCode: -1,
          });
        }

        const items: any[] = data.data ?? data.result ?? [];
        if (items.length === 0) break;

        for (const item of items) {
          const s = item.orderStatus ?? '';
          if (ACTIVE_STATUSES.has(s)) {
            activeOrders.push(normalizeOrder(item));
          } else if (includeDisputes && DISPUTE_STATUSES.has(s)) {
            disputeOrders.push(normalizeOrder(item));
          }
        }

        // Si la última orden tiene más de 30 días, no vale la pena seguir paginando
        const lastItem = items[items.length - 1];
        const lastDate = Number(lastItem?.createTime ?? 0);
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (lastDate > 0 && lastDate < thirtyDaysAgo) break;

        // Si hay menos de 100 resultados, ya llegamos al final
        if (items.length < 100) break;
      }
    }

    // Deduplicar (un orderNumber puede aparecer en BUY y SELL simultáneamente si hay bug en la API)
    const seen = new Set<string>();
    const deduped = activeOrders.filter(o => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });

    return NextResponse.json({
      orders:   deduped,
      disputes: disputeOrders,
      total:    deduped.length,
      active:   deduped.length,
      retCode:  0,
    });
  } catch (e: any) {
    return NextResponse.json({ orders: [], error: e.message, retCode: -2 }, { status: 200 });
  }
}
