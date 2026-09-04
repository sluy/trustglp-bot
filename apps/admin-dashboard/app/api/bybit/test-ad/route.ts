import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function signBybit(apiKey: string, apiSecret: string, bodyStr: string) {
  const timestamp = Date.now().toString();
  const recvWindow = '50000';
  const signPayload = timestamp + apiKey + recvWindow + bodyStr;
  const sign = crypto.createHmac('sha256', apiSecret).update(signPayload).digest('hex');
  return { timestamp, recvWindow, sign };
}

async function bybitPost(apiKey: string, apiSecret: string, endpoint: string, bodyObj: any) {
  const bodyStr = JSON.stringify(bodyObj);
  const { timestamp, recvWindow, sign } = signBybit(apiKey, apiSecret, bodyStr);
  const res = await fetch('https://api.bybit.com' + endpoint, {
    method: 'POST',
    headers: {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'X-BAPI-SIGN': sign,
      'Content-Type': 'application/json'
    },
    body: bodyStr
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

export async function GET(request: Request) {
  const apiKey = 'HPX0pcKzJqW083RVV5';
  const apiSecret = 'GXam2dGdBbZIkom3q6BF274X0ApRimcEJAjU';
  const itemId = '2061543132102045696';

  const results: any = {};

  try {
    const info = await bybitPost(apiKey, apiSecret, '/v5/p2p/item/info', { itemId });
    
    if (!info.result) {
      return NextResponse.json({ error: 'Could not fetch item info', info });
    }

    results.info = info;

    const payload1 = { itemId, price: '741.011' };
    results.test1 = await bybitPost(apiKey, apiSecret, '/v5/p2p/item/update', payload1);
    
    const payload2 = { itemId, amount: '741.012' };
    results.test2 = await bybitPost(apiKey, apiSecret, '/v5/p2p/item/update', payload2);
    
    // Si update falla, testear con la ruta sin V5
    results.test3 = await bybitPost(apiKey, apiSecret, '/fiat/otc/item/update', payload1);
    
  } catch (e: any) {
    results.error = e.message;
  }

  return NextResponse.json(results);
}
