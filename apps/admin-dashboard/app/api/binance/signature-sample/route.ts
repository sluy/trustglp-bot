import { NextResponse } from 'next/server';
import { readBinanceKeys, signBinance } from '../_lib/binance';

export const dynamic = 'force-dynamic';

/**
 * GET /api/binance/signature-sample
 * Genera un ejemplo de solicitud firmada para compartir con soporte de Binance.
 * NO expone el API Secret - solo muestra la firma resultante y los parámetros.
 */
export async function GET(req: Request) {
  const { apiKey, apiSecret } = readBinanceKeys();

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'No API key configured' });
  }

  const url = new URL(req.url);
  const orderId = url.searchParams.get('orderId') || '22888536549695262720';

  const timestamp = Date.now().toString();

  // Parámetros exactos del request que estamos enviando
  const params = {
    orderNo: orderId,
    timestamp,
  };

  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const signature = signBinance(apiSecret, queryString);

  const fullBody = `${queryString}&signature=${signature}`;
  const endpoint = '/sapi/v1/c2c/orderMatch/getUserOrderDetail';
  const fullUrl  = `https://api.binance.com${endpoint}`;

  return NextResponse.json({
    para_binance_support: {
      api_key: apiKey,
      endpoint: `POST ${fullUrl}`,
      content_type: 'application/x-www-form-urlencoded',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'clientType':   'web',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      request_body: fullBody.replace(signature, `${signature.slice(0, 16)}...`),
      full_signature_hex: signature,
      query_string_before_signing: queryString,
      timestamp_used: timestamp,
      algorithm: 'HMAC-SHA256(API_SECRET, queryString)',
      error_received: {
        http_status: 500,
        response_body: '{"code":"-1000","message":"An unknown error occurred while processing the request."}',
      },
    },
    copy_paste_for_support: `
=== INFORMACIÓN PARA SOPORTE BINANCE - Case #161563442 ===

API Key: ${apiKey}
Endpoint: POST https://api.binance.com/sapi/v1/c2c/orderMatch/getUserOrderDetail

Headers enviados:
  X-MBX-APIKEY: ${apiKey}
  clientType: web
  Content-Type: application/x-www-form-urlencoded

Request body:
  ${fullBody.replace(signature, `${signature.slice(0, 16)}[...resto de firma HMAC-SHA256]`)}

Firma completa (HMAC-SHA256):
  ${signature}

Query string firmado (antes de la firma):
  ${queryString}

Respuesta recibida:
  HTTP 500
  {"code":"-1000","message":"An unknown error occurred while processing the request."}

Nota: La misma firma funciona para GET /sapi/v1/c2c/orderMatch/listUserOrderHistory (HTTP 200 OK).
Solo los endpoints POST de escritura dan error -1000.
=== FIN ===
    `.trim(),
  });
}
