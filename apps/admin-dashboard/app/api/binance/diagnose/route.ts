import { NextResponse } from 'next/server';
import { readBinanceKeys, binanceSapi } from '../_lib/binance';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { apiKey, apiSecret } = readBinanceKeys();

  // 1. IP saliente del servidor
  let serverIp = 'No disponible';
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    const ipData = await ipRes.json();
    serverIp = ipData.ip || 'No disponible';
  } catch (e: any) {
    serverIp = `Error: ${e.message}`;
  }

  const results: Record<string, any> = {
    serverIp,
    timestamp: new Date().toISOString(),
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'NO CONFIGURADA',
    tests: {},
  };

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ ok: false, error: 'Falta API Key/Secret', ...results });
  }

  // 2. Test GET - listUserOrderHistory (base)
  let activeOrderId: string | null = null;
  try {
    const r = await binanceSapi('GET', '/sapi/v1/c2c/orderMatch/listUserOrderHistory', {
      tradeType: 'BUY', page: '1', rows: '20'
    }, apiKey, apiSecret);
    const orders = Array.isArray(r) ? r : (r?.data ?? []);
    // Buscar la primera orden PENDIENTE activa
    const pending = orders.find((o: any) =>
      ['PENDING', 'TRADING', 'BUYER_PAYED'].includes(o.orderStatus ?? '')
    );
    if (pending) activeOrderId = pending.orderNumber;
    results.tests.listOrderHistory_GET = {
      ok: true,
      total: orders.length,
      activeOrderFound: !!pending,
      activeOrderId: activeOrderId || 'Ninguna orden activa en este momento',
      statuses: orders.slice(0, 5).map((o: any) => `${o.orderNumber?.slice(-6)}: ${o.orderStatus}`),
    };
  } catch (e: any) {
    results.tests.listOrderHistory_GET = { ok: false, error: e.message };
  }

  // 3. Test getUserOrderDetail en la orden ACTIVA (si hay una)
  if (activeOrderId) {
    for (const [method, param] of [['POST', 'orderNumber'], ['POST', 'orderNo']] as Array<['POST', string]>) {
      try {
        const p: Record<string, string> = {};
        p[param] = activeOrderId;
        const r = await binanceSapi(method, '/sapi/v1/c2c/orderMatch/getUserOrderDetail', p, apiKey, apiSecret);
        results.tests[`getUserOrderDetail_${method}_${param}`] = {
          ok: true,
          payId: r?.payMethods?.[0]?.payId ?? r?.payId ?? 'N/A',
          fields: r?.payMethods?.[0]?.fields ?? [],
          raw_keys: Object.keys(r ?? {}),
        };
        break;
      } catch (e: any) {
        results.tests[`getUserOrderDetail_${method}_${param}`] = {
          ok: false,
          error: e.message,
          isPermissionError: e.message.includes('-1000'),
        };
      }
    }
  } else {
    results.tests.getUserOrderDetail = {
      ok: false,
      skipped: true,
      reason: 'No hay órdenes activas en este momento — espera una orden PENDING y vuelve a ejecutar /diagnose',
    };
  }

  // 4. Test POST markOrderAsPaid con orden ficticia (solo para ver si el formato es correcto)
  try {
    await binanceSapi('POST', '/sapi/v1/c2c/orderMatch/markOrderAsPaid', {
      orderNumber: '00000000000000000000',
    }, apiKey, apiSecret);
    results.tests.markOrderAsPaid_POST = { ok: true, note: 'Inesperado' };
  } catch (e: any) {
    const isGeneric  = e.message.includes('-1000');
    const isNotFound = e.message.includes('-2013') || e.message.includes('order') || e.message.includes('not found');
    results.tests.markOrderAsPaid_POST = {
      ok: false,
      error: e.message,
      diagnosis: isNotFound
        ? '✅ Conectado — la orden de prueba no existe (esperado)'
        : isGeneric
        ? '⚠️ -1000 genérico — puede ser IP, permiso Spot&Margin, o formato de params'
        : 'Error desconocido',
    };
  }

  // 5. Test pre-signed-url
  try {
    await binanceSapi('POST', '/sapi/v1/c2c/chat/image/pre-signed-url', {
      orderNo: '00000000000000000000', imageName: 'test.jpg',
    }, apiKey, apiSecret);
    results.tests.preSignedUrl_POST = { ok: true };
  } catch (e: any) {
    results.tests.preSignedUrl_POST = {
      ok: false, error: e.message,
      isGeneric: e.message.includes('-1000'),
    };
  }

  // 6. Test getUserPaymentMethods (para obtener payId estático)
  for (const path of [
    '/sapi/v1/c2c/ads/listUserPaymentMethods',
    '/sapi/v1/c2c/ads/getOwnPaymentMethods',
  ]) {
    try {
      const r = await binanceSapi('GET', path, {}, apiKey, apiSecret);
      results.tests[`paymentMethods_${path.split('/').pop()}`] = {
        ok: true, data: JSON.stringify(r).slice(0, 300),
      };
    } catch (e: any) {
      results.tests[`paymentMethods_${path.split('/').pop()}`] = {
        ok: false, error: e.message.slice(0, 100),
      };
    }
  }

  // Diagnóstico
  const allPostFail = !!(results.tests.markOrderAsPaid_POST?.error && results.tests.preSignedUrl_POST?.error);
  results.diagnosis = {
    serverIp,
    postEndpointsWork: !allPostFail,
    activeOrderTested: !!activeOrderId,
    recommendation: !results.tests.listOrderHistory_GET?.ok
      ? '❌ API Key sin permisos de lectura básicos'
      : activeOrderId && results.tests[`getUserOrderDetail_POST_orderNumber`]?.ok
      ? '✅ Todo funciona correctamente'
      : activeOrderId && !results.tests[`getUserOrderDetail_POST_orderNumber`]?.ok
      ? '❌ getUserOrderDetail falla en orden activa — revisar permiso "Enable Spot & Margin Trading" en la API key'
      : '⚠️ Sin órdenes activas para probar escritura — crear una orden de compra P2P para testear',
  };

  return NextResponse.json({ ok: true, ...results });
}
