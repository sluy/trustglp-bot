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
    const body = await req.json();
    const { textContent } = body;

    if (!textContent) {
       return NextResponse.json({ ok: false, error: 'No textContent provided.' });
    }

    const res = await sendSapiChatMessage(orderId, textContent, 'text', apiKey, apiSecret);
    
    if (res.ok) {
       return NextResponse.json({ ok: true, message: 'Message sent' });
    } else {
       return NextResponse.json({ ok: false, error: res.error });
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
