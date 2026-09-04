import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

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

// ─── BYBIT SIGNING (idéntico al bybit-p2p.service.ts del p2p-marketplace) ────
// CRÍTICO: Se requiere el header X-BAPI-SIGN-TYPE: '2' para endpoints P2P
function makeBybitHeaders(apiKey: string, apiSecret: string, bodyStr: string) {
  const timestamp  = Date.now().toString();
  const recvWindow = '5000';
  const preSign    = timestamp + apiKey + recvWindow + bodyStr;
  const sign       = crypto.createHmac('sha256', apiSecret).update(preSign).digest('hex');
  return {
    'X-BAPI-API-KEY':     apiKey,
    'X-BAPI-SIGN':        sign,
    'X-BAPI-SIGN-TYPE':   '2',       // ← REQUERIDO para P2P API
    'X-BAPI-TIMESTAMP':   timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'Content-Type':       'application/json',
  };
}

async function bybitPost(apiKey: string, apiSecret: string, endpoint: string, bodyObj: any) {
  const bodyStr = JSON.stringify(bodyObj);
  const res = await fetch(`https://api.bybit.com${endpoint}`, {
    method: 'POST',
    headers: makeBybitHeaders(apiKey, apiSecret, bodyStr),
    body: bodyStr,
    cache: 'no-store',
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`no-JSON: ${text.slice(0, 200)}`); }
}

// Códigos de pago Bybit → nombre legible (Venezuela)
const BYBIT_PAYMENT_CODES: Record<string, string> = {
  '14':  'Banesco',     '16':  'Banesco (Oficial)',
  '130': 'Banesco',     '137': 'Banesco (Oficial)',
  '253': 'Banesco',     '585': 'Banesco (VES)',
  '316': 'Mercantil',   '321': 'Mercantil (Oficial)',
  '317': 'Banco de Venezuela', '302': 'BDV',
  '319': 'BOD',         '320': 'BNC',
  '322': 'Banplus',     '323': 'Bicentenario',
  '324': 'Sofitasa',    '315': 'BBVA Provincial',
  '318': 'Pago Móvil',  '377': 'Pago Móvil (Banesco)',
  '382': 'Pago Móvil (Mercantil)', '416': 'Pago Móvil (BDV)',
  '390': 'Zelle',
};

function resolvePaymentName(val: any): string {
  if (!val) return '—';
  const s = String(val);
  return BYBIT_PAYMENT_CODES[s] ?? s;
}

export async function GET(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;

  if (!orderId || orderId === 'undefined' || orderId === 'null') {
    return NextResponse.json({ result: null, error: 'orderId inválido' }, { status: 200 });
  }

  const keys = readKeys();
  const bybitApiKey    = (keys.bybitApiKey    && !isMasked(keys.bybitApiKey))    ? keys.bybitApiKey    : (process.env.BYBIT_API_KEY    || '');
  const bybitApiSecret = (keys.bybitApiSecret && !isMasked(keys.bybitApiSecret)) ? keys.bybitApiSecret : (process.env.BYBIT_API_SECRET || '');

  if (!bybitApiKey || !bybitApiSecret) {
    return NextResponse.json({ result: null, error: 'API keys no configuradas' }, { status: 200 });
  }

  try {
    // ── Paso 1: GET ORDER INFO (incluye paymentTermList con datos bancarios) ──
    // NOTA: Requiere X-BAPI-SIGN-TYPE: '2' (cabecera crítica para P2P API)
    const orderInfoRes = await bybitPost(bybitApiKey, bybitApiSecret, '/v5/p2p/order/info', { orderId });

    const retCode = orderInfoRes.retCode ?? orderInfoRes.ret_code;
    if (retCode !== 0) {
      // Si falla, intentar en simplifyList como fallback
      let rawOrder: any = null;
      for (let page = 1; page <= 10; page++) {
        const r = await bybitPost(bybitApiKey, bybitApiSecret, '/v5/p2p/order/simplifyList', { page, size: 10 });
        if ((r.retCode ?? r.ret_code) !== 0) break;
        const items: any[] = r.result?.items ?? r.result?.list ?? [];
        rawOrder = items.find((i: any) => String(i.id ?? i.orderId) === String(orderId));
        if (rawOrder) break;
        if (items.length < 10) break;
      }

      if (!rawOrder) {
        return NextResponse.json({
          result: null,
          error: `order/info: ${orderInfoRes.retMsg ?? orderInfoRes.ret_msg} (retCode ${retCode})`,
        });
      }

      // Con datos de simplifyList (no tiene paymentTermList completo)
      return NextResponse.json({
        result: {
          buyerRealName:     rawOrder.buyerRealName ?? rawOrder.realName ?? null,
          sellerRealName:    rawOrder.sellerRealName ?? null,
          identityNo:        rawOrder.identityNo ?? null,
          chatDetectedAccount: null,
          paymentTermList:   [],
          side:              rawOrder.side,
          status:            rawOrder.status,
          tokenId:           rawOrder.tokenId ?? 'USDT',
          currencyId:        rawOrder.currencyId ?? 'VES',
          quantity:          rawOrder.notifyTokenQuantity ?? rawOrder.quantity,
          price:             rawOrder.price,
          amount:            rawOrder.amount,
          _source:           'simplifyList_fallback',
        },
        retCode: 0,
      });
    }

    // ── Éxito: parsear order/info ─────────────────────────────────────────────
    const orderData = orderInfoRes.result ?? {};

    // El paymentTermList viene directamente del resultado
    // Estructura: [{id, paymentType, realName, accountNo, paymentText1, paymentText2...}]
    const rawTerms: any[] = orderData.paymentTermList ?? orderData.paymentList ?? [];
    const paymentTermList = rawTerms.map((p: any) => ({
      paymentType:  resolvePaymentName(p.id ?? p.paymentType ?? p.paymentId),
      bankName:     resolvePaymentName(p.id ?? p.paymentType ?? p.paymentId),
      accountNo:    p.accountNo    ?? p.bankAccountNo ?? null,
      realName:     p.realName     ?? p.accountName   ?? null,
      paymentText1: p.paymentText1 ?? p.paymentExt1   ?? p.identityNo  ?? null,
      paymentText2: p.paymentText2 ?? p.paymentExt2   ?? null,
      paymentText3: p.paymentText3 ?? p.paymentExt3   ?? null,
      id:           p.id           ?? p.paymentId     ?? null,
      online:       true,
    }));

    // KYC del comprador/vendedor
    const buyerRealName  = orderData.buyerRealName  ?? orderData.realName ?? null;
    const sellerRealName = orderData.sellerRealName ?? null;
    const identityNo     = orderData.identityNo     ?? null;

    // ── Paso 2: GET CHAT MESSAGES (extraer cuenta bancaria y cédula del chat) ──
    let chatDetectedAccount: string | null = null;
    let chatDetectedCedula:  string | null = null;
    try {
      const chatRes = await bybitPost(bybitApiKey, bybitApiSecret, '/v5/p2p/order/message/listpage', {
        orderId,
        page: '1',
        size: '50',
      });
      if ((chatRes.retCode ?? chatRes.ret_code) === 0) {
        const chatMessages: any[] = chatRes.result?.result ?? chatRes.result?.list ?? chatRes.result?.rows ?? [];

        // Recorrer del mensaje más reciente al más antiguo
        for (const msg of [...chatMessages].reverse()) {
          const raw = msg.message ?? msg.content ?? msg.msg ?? msg.text ?? '';
          const text = typeof raw === 'string' ? raw : '';

          // ─ Detectar cuenta bancaria venezolana (20 dígitos) ─────────────────────
          // Formatos: 01340194211941027544 | 0134-0328-79-3281080676 | 0134 0194 21 1941027544
          if (!chatDetectedAccount) {
            // 1. 20 dígitos consecutivos empezando con 0
            const m1 = text.match(/(?<![.\d])(0\d{19})(?![\d])/);
            if (m1) {
              chatDetectedAccount = m1[1];
            } else {
              // 2. Formato venezolano con guiones: 0XXX-XXXX-XX-XXXXXXXXXX (4-4-2-10 u otras combinaciones)
              //    Buscamos una secuencia que empiece con 0 y al quitar separadores dé 20 dígitos
              const allMatches = [...text.matchAll(/0[\d][\d\-\s\.]{15,30}[\d]/g)];
              for (const m of allMatches) {
                const digits = m[0].replace(/[\s\-\.]/g, '');
                if (digits.length === 20 && /^0\d{3}/.test(digits)) {
                  chatDetectedAccount = digits;
                  break;
                }
              }
            }
          }

          // ─ Detectar cédula venezolana ────────────────────────────────────────────
          // Formatos: V-11736561 | E-22366834 | V11736561 | 11736561
          if (!chatDetectedCedula) {
            // Con prefijo V/E (con o sin guión/punto/espacio)
            const mPref = text.match(/[VvEe][-.\s]?([\d.]{6,11})/);
            if (mPref) {
              const digits = mPref[1].replace(/\./g, '');
              if (digits.length >= 6 && digits.length <= 9) {
                chatDetectedCedula = digits;
              }
            } 
            
            if (!chatDetectedCedula) {
              // Sin prefijo: 7-9 dígitos aislados, con posibles puntos
              const allMatches = [...text.matchAll(/(?<![\d.])([\d.]{7,11})(?![\d.])/g)];
              for (const m of allMatches) {
                 const digits = m[1].replace(/\./g, '');
                 if (digits.length >= 7 && digits.length <= 9) {
                    if (!chatDetectedAccount || !chatDetectedAccount.includes(digits)) {
                       chatDetectedCedula = digits;
                       break;
                    }
                 }
              }
            }
          }

          if (chatDetectedAccount && chatDetectedCedula) break;
        }
      }
    } catch (_) { /* chat no crítico */ }

    return NextResponse.json({
      result: {
        buyerRealName,
        sellerRealName,
        identityNo,
        chatDetectedAccount,
        chatDetectedCedula,
        paymentTermList,
        side:       orderData.side,
        status:     orderData.status,
        tokenId:    orderData.tokenId    ?? 'USDT',
        currencyId: orderData.currencyId ?? 'VES',
        quantity:   orderData.notifyTokenQuantity ?? orderData.quantity,
        price:      orderData.price,
        amount:     orderData.amount,
        createDate: orderData.createDate,
        _source:    'order_info',
      },
      retCode: 0,
    });

  } catch (e: any) {
    return NextResponse.json({ result: null, error: e.message }, { status: 200 });
  }
}
