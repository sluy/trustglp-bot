import { NextResponse } from 'next/server';
import { readBinanceKeys, sendSapiChatMessage } from '../../../../_lib/binance';

export const dynamic = 'force-dynamic';

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
    const textContent = "Por favor, indíquenos sus datos bancarios por este chat para proceder con el pago.";
    const result = await sendSapiChatMessage(orderId, textContent, 'text', apiKey, apiSecret);

    if (result.ok) {
      return NextResponse.json({ ok: true, message: '✅ Solicitud de datos enviada exitosamente.' });
    } else {
      return NextResponse.json({ ok: false, error: result.error });
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
