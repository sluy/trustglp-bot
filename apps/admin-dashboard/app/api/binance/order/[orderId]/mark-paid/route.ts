import { NextResponse } from 'next/server';
import { readBinanceKeys, readBinanceCookies, binanceBapi, binanceSapi } from '../../../_lib/binance';

export const dynamic = 'force-dynamic';

/**
 * POST /api/binance/order/[orderId]/mark-paid
 * Body JSON: { payId?: string }
 *
 * ESTRATEGIA:
 * 1. Si hay cookies de sesión → BAPI (confirm-payment) — siempre funciona
 * 2. Sin cookies → SAPI markOrderAsPaid (funciona si Binance lo permite)
 */
export async function POST(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;
  const { apiKey, apiSecret } = readBinanceKeys();
  const cookies = readBinanceCookies();

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ ok: false, error: 'Falta Binance API Key o Secret.' });
  }

  let payId = '';
  try {
    const body = await req.json();
    payId = body.payId ? String(body.payId) : '';
  } catch {}

  const errors: string[] = [];

  // ================================================================
  // MÉTODO 1: SAPI markOrderAsPaid (API Keys - Oficial)
  // ================================================================
  const sapiVariants: Array<Record<string, string>> = [];
  if (payId) {
    sapiVariants.push(
      { orderNumber: orderId, payId },
      { orderNo: orderId, payId },
    );
  }
  sapiVariants.push(
    { orderNumber: orderId },
    { orderNo: orderId },
  );

  for (const p of sapiVariants) {
    try {
      const result = await binanceSapi('POST', '/sapi/v1/c2c/orderMatch/markOrderAsPaid', p, apiKey, apiSecret);
      return NextResponse.json({
        ok: true,
        result,
        method: 'SAPI',
        resolvedWith: `/sapi/v1/c2c/orderMatch/markOrderAsPaid [${JSON.stringify(p)}]`,
      });
    } catch (e: any) {
      errors.push(`Error API: ${e.message}`);
    }
  }

    // =================================================================
    // FLUJO SAPI: Envío Directo (Estructura Híbrida)
    // =================================================================
    try {
      // Usamos orderNumber como el parámetro oficial requerido por Binance
      const markPaidRes = await binanceSapi('POST', '/sapi/v1/c2c/orderMatch/markOrderAsPaid', {
        orderNumber: orderId
      }, apiKey, apiSecret);

      if (markPaidRes.ok || markPaidRes.code === '000000' || markPaidRes.success === true) {
        return NextResponse.json({ ok: true, data: markPaidRes.data ?? markPaidRes });
      } else {
        errors.push(`SAPI Error: ${markPaidRes.code} - ${markPaidRes.msg}`);
      }
    } catch (e: any) {
      errors.push(`SAPI Excepción: ${e.message}`);
    }

  // ================================================================
  // MÉTODO 2: BAPI (Fallback con Cookies de Sesión)
  // ================================================================
  if (cookies) {
    const bapiVariants: Array<Record<string, string>> = [
      { orderNo: orderId },
      { orderNumber: orderId },
    ];
    if (payId) {
      bapiVariants.unshift(
        { orderNo: orderId, payId },
        { orderNumber: orderId, payId },
      );
    }

    for (const p of bapiVariants) {
      try {
        const result = await binanceBapi(
          'POST',
          '/bapi/c2c/v2/private/c2c/order-match/confirm-payment',
          p, apiKey, apiSecret, cookies,
        );
        return NextResponse.json({
          ok: true,
          result,
          method: 'BAPI',
          resolvedWith: `BAPI confirm-payment [${JSON.stringify(p)}]`,
        });
      } catch (e: any) {
        errors.push(`Error Sesión Web: ${e.message}`);
      }
    }
  }

  const uniqueErrors = Array.from(new Set(errors));
  return NextResponse.json({
    ok: false,
    error: uniqueErrors.length > 0 ? uniqueErrors.join(' | ') : 'No se pudo marcar la orden como pagada.',
    hasCookies: !!cookies,
    hint: !cookies ? '💡 Configura tus cookies de sesión en Config → API Keys → Binance Session Cookies para habilitar esta función.' : undefined,
    allErrors: uniqueErrors,
  });
}
