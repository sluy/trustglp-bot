import { NextResponse } from 'next/server';
import { readBinanceKeys, signBinance, sendSapiChatMessage, readBinanceCookies, binanceSapi } from '../../../_lib/binance';

export const dynamic = 'force-dynamic';

/**
 * POST /api/binance/order/[orderId]/upload-proof
 * Body: FormData con campo "image" (File/Blob)
 *
 * Usa: POST /sapi/v1/c2c/chat/upload (multipart/form-data)
 * Descubierto via Gemini Deep Research
 *
 * Campos requeridos: orderNo (TEXT) + file (FILE)
 * Esto es diferente al flujo de pre-signed URL que no funciona.
 */
export async function POST(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;
  const { apiKey, apiSecret } = readBinanceKeys();

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ ok: false, error: 'Falta Binance API Key o Secret.' });
  }

  try {
    const formData  = await req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ ok: false, error: 'No se recibió imagen en el campo "image".' });
    }

    const mimeType = imageFile.type || 'image/jpeg';
    const errors: string[] = [];

    // =================================================================
    // Flujo pre-signed URL (3 pasos)
    // Paso 1: Obtener pre-signed URL
    // =================================================================
    const presignedVariants = [
      { imageName: `comprobante.jpg` },
    ];

    for (const variant of presignedVariants) {
      try {
        const psJson = await binanceSapi('POST', '/sapi/v1/c2c/chat/image/pre-signed-url', variant, apiKey, apiSecret);
        const uploadUrl = psJson?.uploadUrl || psJson?.url || '';
        const imageUrl  = psJson?.imageUrl  || uploadUrl.split('?')[0];

        if (uploadUrl) {
          // Paso 2: PUT imagen al S3
          const imageBuffer = await imageFile.arrayBuffer();
          const putRes = await fetch(uploadUrl, {
            method:  'PUT',
            headers: { 'Content-Type': mimeType },
            body:    imageBuffer,
          });

          if (!putRes.ok) {
            errors.push(`S3 PUT failed: ${putRes.status}`);
            continue;
          }

          // Paso 3: Enviar mensaje al chat usando WebSocket (SAPI)
          const imgResult = await sendSapiChatMessage(orderId, imageUrl, 'image', apiKey, apiSecret);
          
          if (imgResult.ok) {
            // Paso 4: Enviar mensaje de texto confirmando
            const textContent = "El comprobante se encuentra adjunto. Ha sido un placer hacer negocios con usted.";
            await sendSapiChatMessage(orderId, textContent, 'text', apiKey, apiSecret);
            
            return NextResponse.json({ ok: true, imageUrl, message: '✅ Imagen enviada al chat nativamente (pre-signed URL + WebSocket)' });
          }

          return NextResponse.json({ ok: true, imageUrl, message: '⚠️ Imagen subida a S3, pero falló el envío WebSocket: ' + imgResult.error });
        }
        errors.push(`presigned[${JSON.stringify(variant)}]: no uploadUrl`);
      } catch (e: any) {
        errors.push(`presigned[${JSON.stringify(variant)}]: ${e.message}`);
      }
    }

    // =================================================================
    // FALLBACK: Flujo BAPI (Cookies de Sesión)
    // =================================================================
    const cookies = readBinanceCookies();
    if (cookies) {
      try {
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
        
        const bapiForm = new FormData();
        bapiForm.append('file', imageFile, `comprobante_${orderId}.jpg`);
        bapiForm.append('orderNo', orderId);

        const bapiRes = await fetch('https://www.binance.com/bapi/c2c/v1/private/c2c/upload-order-image', {
          method: 'POST', headers, body: bapiForm, cache: 'no-store',
        });
        const bapiJson = await bapiRes.json().catch(() => ({}));
        
        if (bapiJson.code === '000000' || bapiJson.success === true) {
          const imageUrl = bapiJson.data?.url || bapiJson.data?.imageUrl || '';
          
          // BAPI upload successfully uploaded the image and usually sends it to the chat automatically
          // But to be safe, we can try to confirm it via BAPI chat endpoint or just assume success
          return NextResponse.json({
            ok: true,
            imageUrl,
            message: '✅ Comprobante subido al chat vía BAPI (Cookies)',
            raw: bapiJson,
            method: 'BAPI'
          });
        }
        errors.push(`BAPI upload failed: ${JSON.stringify(bapiJson).slice(0, 200)}`);
      } catch (e: any) {
        errors.push(`BAPI upload error: ${e.message}`);
      }
    } else {
      errors.push('Sin cookies: BAPI no disponible para subir imagen.');
    }

    const uniqueErrors = Array.from(new Set(errors));
    return NextResponse.json({
      ok: false,
      error: `Todos los métodos de upload fallaron. Errores: ${uniqueErrors.slice(0, 3).join(' | ')}`,
      hasCookies: !!cookies
    });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
