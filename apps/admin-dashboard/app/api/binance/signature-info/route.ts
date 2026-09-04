import { NextResponse } from 'next/server';
import { readBinanceKeys, signBinance } from '../_lib/binance';

export const dynamic = 'force-dynamic';

/**
 * GET /api/binance/signature-info
 * Genera la firma exacta que estamos enviando para que Binance Support
 * pueda verificarla en su backend. (Case #161563442)
 */
export async function GET(req: Request) {
  const { apiKey, apiSecret } = readBinanceKeys();
  if (!apiKey || !apiSecret) return NextResponse.json({ error: 'No API key configured' });

  const { searchParams } = new URL(req.url);
  const orderNo = searchParams.get('orderNo') || '22889671030292701184';

  const timestamp = Date.now().toString();

  // ── Exactamente como el código Python oficial de Binance ──────────
  // urlencode({"orderNo": orderNo})
  const queryString  = `orderNo=${orderNo}&timestamp=${timestamp}`;
  const signature    = signBinance(apiSecret, queryString);
  const fullUrl      = `https://api.binance.com/sapi/v1/c2c/orderMatch/getUserOrderDetail?${queryString}&signature=${signature}`;

  // También para markOrderAsPaid
  const ts2          = Date.now().toString();
  const qs2          = `orderNo=${orderNo}&timestamp=${ts2}`;
  const sig2         = signBinance(apiSecret, qs2);
  const fullUrlPaid  = `https://api.binance.com/sapi/v1/c2c/orderMatch/markOrderAsPaid?${qs2}&signature=${sig2}`;

  // ── Ejecutar el request real y capturar la respuesta ─────────────
  let liveResponse: any = null;
  try {
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY':    apiKey,
        'User-Agent':      'python-requests/2.31.0',
        'Accept':          '*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Connection':      'keep-alive',
      },
      cache: 'no-store',
    });
    liveResponse = await res.json().catch(() => null);
  } catch (e: any) {
    liveResponse = { fetchError: e.message };
  }

  return NextResponse.json({
    note:        'Información completa de firma para Binance Support (Case #161563442)',
    apiKeyPreview: apiKey.slice(0, 16) + '...',

    // Lo que envía el código Python exactamente
    request: {
      method:      'POST',
      endpoint:    '/sapi/v1/c2c/orderMatch/getUserOrderDetail',
      queryString,
      signature,
      fullUrl,
      headers: {
        'X-MBX-APIKEY': apiKey.slice(0, 16) + '...(masked)',
        'User-Agent':   'python-requests/2.31.0',
        'Accept':       '*/*',
      },
    },

    // Respuesta real de Binance al ejecutar el request
    binanceResponse: liveResponse,

    // Para markOrderAsPaid también
    markPaidRequest: {
      method:      'POST',
      endpoint:    '/sapi/v1/c2c/orderMatch/markOrderAsPaid',
      queryString: qs2,
      signature:   sig2,
      fullUrl:     fullUrlPaid,
    },
  });
}
