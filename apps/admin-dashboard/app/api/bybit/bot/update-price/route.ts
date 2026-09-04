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

function signBybit(apiKey: string, apiSecret: string, body: string) {
  const timestamp  = Date.now().toString();
  const recvWindow = '50000'; // Window ampliado por si hay delay
  const preSign    = timestamp + apiKey + recvWindow + body;
  const sign       = crypto.createHmac('sha256', apiSecret).update(preSign).digest('hex');
  return { timestamp, recvWindow, sign };
}

export async function POST(req: Request) {
  try {
    const { itemId, price, amount, minAmount, maxAmount, paymentId } = await req.json();

    if (!itemId || !price) {
      return NextResponse.json({ ok: false, error: 'Faltan parámetros: itemId, price' }, { status: 400 });
    }

    const keys = readKeys();
    const apiKey = keys.bybitApiKey;
    const apiSecret = keys.bybitApiSecret;

    if (!apiKey || !apiSecret || isMasked(apiKey) || isMasked(apiSecret)) {
      return NextResponse.json({ ok: false, error: 'Credenciales de Bybit no configuradas o enmascaradas' }, { status: 401 });
    }

    // 1. Obtener la lista de métodos de pago del usuario
    const listBodyStr = "{}"; // Endpoint V5 P2P payment list no requiere cuerpo o requiere vacío
    const listSign = signBybit(apiKey, apiSecret, listBodyStr);
    
    let currentPaymentIds: string[] = [];
    let infoData: any = null;
    
    try {
      const listRes = await fetch('https://api.bybit.com/v5/p2p/user/payment/list', {
        method: 'POST',
        headers: {
          'Content-Type':       'application/json',
          'X-BAPI-API-KEY':     apiKey,
          'X-BAPI-TIMESTAMP':   listSign.timestamp,
          'X-BAPI-RECV-WINDOW': listSign.recvWindow,
          'X-BAPI-SIGN':        listSign.sign
        },
        body: listBodyStr
      });
      const listData = await listRes.json();
      
      const paymentsArray = Array.isArray(listData?.result) ? listData.result : (listData?.result?.data || []);
      
      if (paymentsArray.length > 0) {
         // Compatibilidad por si el frontend tiene caché viejo enviando 14 o 64
         let targetType = String(paymentId);
         if (targetType === "14") targetType = "137";
         if (targetType === "64") targetType = "130";
         
         const methodMatch = paymentsArray.find((p: any) => String(p.paymentType) === targetType);
         
         if (methodMatch && methodMatch.id) {
           currentPaymentIds = [String(methodMatch.id)];
         } else {
           currentPaymentIds = [String(paymentsArray[0].id)];
         }
      } else {
         infoData = listData; // Para mostrar el error si falla
      }
    } catch (err) {
      console.log('Error fetching payment list:', err);
    }
    
    // Si la info no devolvió pagos, abortamos con el error exacto para debugear
    if (currentPaymentIds.length === 0) {
       return NextResponse.json({ 
         ok: false, 
         error: `User payment info failed. Response: ${JSON.stringify(infoData || 'No data')}`
       }, { status: 400 });
    }

    // 2. El payload exacto como lo requiere Bybit V5 P2P OpenAPI
    const bodyObj: any = { 
      id: String(itemId), 
      actionType: "MODIFY",
      priceType: "0",
      price: String(price),
      quantity: String(amount),
      minAmount: String(minAmount),
      maxAmount: String(maxAmount),
      paymentPeriod: "30",
      paymentIds: currentPaymentIds
    };
    
    const bodyStr = JSON.stringify(bodyObj);
    const { timestamp, recvWindow, sign } = signBybit(apiKey, apiSecret, bodyStr);

    const res = await fetch('https://api.bybit.com/v5/p2p/item/update', {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'X-BAPI-API-KEY':     apiKey,
        'X-BAPI-TIMESTAMP':   timestamp,
        'X-BAPI-SIGN':        sign,
        'X-BAPI-SIGN-TYPE':   '2',
        'X-BAPI-RECV-WINDOW': recvWindow,
      },
      body: bodyStr,
      cache: 'no-store',
    });

    const text = await res.text();
    let json: any = {};
    try { 
      json = JSON.parse(text); 
    } catch { 
      return NextResponse.json({ ok: false, error: 'Respuesta no-JSON de Bybit', details: text }, { status: 500 });
    }

    if (json.retCode !== 0 && json.ret_code !== 0) {
      return NextResponse.json({ ok: false, error: json.retMsg || json.ret_msg || 'Error en Bybit', details: json }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: 'Precio actualizado con éxito', result: json.result || json });

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
