import { NextResponse } from 'next/server';
import { readBinanceKeys, binanceSapi } from '../../_lib/binance';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemId, price } = body;

    const { apiKey, apiSecret } = readBinanceKeys();
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ ok: false, error: 'Binance API Keys missing' }, { status: 400 });
    }

    if (!itemId) {
      return NextResponse.json({ ok: false, error: 'Missing itemId (advNo)' }, { status: 400 });
    }

    // Call Binance SAPI to update the P2P ad price and limits
    // POST /sapi/v1/c2c/ads/update requires advNo and price, limits are optional
    const params: any = {
      advNo: itemId,
      price: Number(price)
    };

    const result = await binanceSapi('POST', '/sapi/v1/c2c/ads/update', params, apiKey, apiSecret);

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error('Binance update-price error:', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
