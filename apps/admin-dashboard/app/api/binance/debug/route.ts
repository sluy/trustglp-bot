import { NextResponse } from 'next/server';
import { readBinanceKeys, readBinanceCookies, binanceBapi, signBinance } from '../_lib/binance';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request) {
  const { apiKey, apiSecret } = readBinanceKeys();
  const cookies = readBinanceCookies();

  if (!apiKey || !apiSecret) return NextResponse.json({ error: 'No API key' });

  // ── Generar firma real para Binance Support (Case #161563442) ─────
  const ts1          = Date.now().toString();
  const orderForSig  = '22889671030292701184';
  const queryString  = `orderNo=${orderForSig}&timestamp=${ts1}`;
  const signature    = signBinance(apiSecret, queryString);
  const fullUrl      = `https://api.binance.com/sapi/v1/c2c/orderMatch/getUserOrderDetail?${queryString}&signature=${signature}`;

  const ts2          = Date.now().toString();
  const qs2          = `orderNo=${orderForSig}&timestamp=${ts2}`;
  const sig2         = signBinance(apiSecret, qs2);
  const fullUrlPaid  = `https://api.binance.com/sapi/v1/c2c/orderMatch/markOrderAsPaid?${qs2}&signature=${sig2}`;

  // ── Ejecutar el request real ──────────────────────────────────────
  let binanceRawResponse: any = null;
  try {
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': apiKey, 'User-Agent': 'python-requests/2.31.0', 'Accept': '*/*' },
      cache: 'no-store',
    });
    binanceRawResponse = await res.json().catch(() => null);
  } catch (e: any) {
    binanceRawResponse = { error: e.message };
  }

  // ── Info cookies ─────────────────────────────────────────────────
  const hasP20t = cookies.includes('p20t=');
  const p20tVal = cookies.match(/p20t=([^;]+)/)?.[1] || '';
  results.push({
    label:    '🍪 Session cookies',
    ok:       hasP20t,
    cookieLen: cookies.length,
    hasP20t,
    p20tPreview: p20tVal.slice(0, 30) + '...',
  });

  // ── Obtener orden activa ─────────────────────────────────────────
  let orderNo = '';
  let orderStatus = '';
  try {
    const ts  = Date.now().toString();
    const qs  = `tradeType=BUY&page=1&rows=5&timestamp=${ts}`;
    const sig = signBinance(apiSecret, qs);
    const res = await fetch(`https://api.binance.com/sapi/v1/c2c/orderMatch/listUserOrderHistory?${qs}&signature=${sig}`, {
      headers: { 'X-MBX-APIKEY': apiKey }, cache: 'no-store',
    });
    const json = await res.json();
    const orders: any[] = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
    const active = orders.find((o: any) => ['TRADING', 'PENDING', 'BUY_PENDING'].includes(o.orderStatus));
    const target = active || orders[0];
    orderNo     = target?.orderNumber || '';
    orderStatus = target?.orderStatus || '';
    results.push({
      label:      '✅ Orden para test',
      orderNo,
      orderStatus,
      tradeType:  target?.tradeType,
      amount:     `${target?.amount} ${target?.asset}`,
    });
  } catch (e: any) {
    results.push({ label: '❌ Error obteniendo orden', error: e.message });
  }

  if (!orderNo) orderNo = '22889074656929521664';

  // ── TEST A: BAPI getUserOrderDetail (sin firma, JSON body) ────────
  try {
    const data = await binanceBapi('POST',
      '/bapi/c2c/v2/private/c2c/order-match/getUserOrderDetail',
      { orderNo }, apiKey, apiSecret, cookies);
    results.push({ label: '🎯 BAPI getUserOrderDetail', ok: true, data });
  } catch (e: any) {
    const code = e.message.match(/BAPI (\S+):/)?.[1] || 'err';
    results.push({ label: '🔴 BAPI getUserOrderDetail', ok: false, code, msg: e.message.slice(0, 150) });
  }

  // ── TEST B: BAPI confirm-payment (MARCAR PAGADO) ──────────────────
  try {
    const data = await binanceBapi('POST',
      '/bapi/c2c/v2/private/c2c/order-match/confirm-payment',
      { orderNo }, apiKey, apiSecret, cookies);
    results.push({ label: '✅🎯 BAPI confirm-payment (MARCAR PAGADO)', ok: true, data });
  } catch (e: any) {
    const code = e.message.match(/BAPI (\S+):/)?.[1] || 'err';
    results.push({ label: '🔴 BAPI confirm-payment', ok: false, code, msg: e.message.slice(0, 150) });
  }

  // ── TEST C: BAPI upload-order-image (imagen PNG 1x1) ─────────────
  try {
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pngBuf = Buffer.from(pngB64, 'base64');
    const formData = new FormData();
    formData.append('file', new Blob([pngBuf], { type: 'image/png' }), 'comprobante.png');
    formData.append('orderNo', orderNo);
    // upload usa multipart/form-data (NO JSON body) — llamada directa
    const csrf = cookies.split(';').find(c => c.trim().startsWith('csrftoken='))?.split('=')[1]?.trim() || '';
    const headers: Record<string, string> = {
      'Cookie':          cookies,
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':          'application/json, text/plain, */*',
      'Accept-Language': 'es-419,es;q=0.9',
      'Origin':          'https://www.binance.com',
      'Referer':         'https://www.binance.com/es/p2p/trade/sell/USDT',
      'Sec-Fetch-Dest':  'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-origin',
      'clientType':      'web', 'lang': 'es',
    };
    if (csrf) headers['Csrftoken'] = csrf;
    const res  = await fetch('https://www.binance.com/bapi/c2c/v1/private/c2c/upload-order-image', {
      method: 'POST', headers, body: formData, cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    results.push({
      label: json.code === '000000' ? '✅ BAPI upload-order-image' : '🔴 BAPI upload-order-image',
      ok: json.code === '000000', code: json.code, msg: json.message || json.msg || '', data: json.data,
    });
  } catch (e: any) {
    results.push({ label: '🔴 BAPI upload-order-image', ok: false, msg: e.message.slice(0, 150) });
  }

  return NextResponse.json({
    ok:         true,
    orderNo,
    orderStatus,
    hasCookies: !!cookies,
    cookieLen:  cookies.length,

    // ── FIRMA para Binance Support (Case #161563442) ─────────────
    signatureInfo: {
      note: 'Firma HMAC-SHA256 exacta enviada con el código Python oficial de Binance',
      getUserOrderDetail: {
        method:      'POST',
        endpoint:    '/sapi/v1/c2c/orderMatch/getUserOrderDetail',
        queryString,
        signature,
        fullUrl,
        headers: { 'X-MBX-APIKEY': apiKey.slice(0, 20) + '...(parcial)', 'User-Agent': 'python-requests/2.31.0' },
      },
      binanceResponse: binanceRawResponse,
      markOrderAsPaid: {
        method:      'POST',
        endpoint:    '/sapi/v1/c2c/orderMatch/markOrderAsPaid',
        queryString: qs2,
        signature:   sig2,
        fullUrl:     fullUrlPaid,
      },
    },

    results,
    summary: results.map(r => ({
      label: r.label,
      ok:    !!r.ok,
      code:  r.code,
      msg:   String(r.msg || r.error || '').slice(0, 200),
    })),
  });
}
