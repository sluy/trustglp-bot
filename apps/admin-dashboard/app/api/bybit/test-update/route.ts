import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const DATA_DIR  = '/app/data';
const KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');

function readKeys(): Record<string, string> {
  try {
    if (!existsSync(KEYS_FILE)) return {};
    return JSON.parse(readFileSync(KEYS_FILE, 'utf-8'));
  } catch { return {}; }
}

function signBybit(apiKey: string, apiSecret: string, body: string) {
  const timestamp  = Date.now().toString();
  const recvWindow = '50000';
  const preSign    = timestamp + apiKey + recvWindow + body;
  const sign       = crypto.createHmac('sha256', apiSecret).update(preSign).digest('hex');
  return { timestamp, recvWindow, sign };
}

export async function GET() {
  try {
    const keys = readKeys();
    const apiKey = keys.bybitApiKey;
    const apiSecret = keys.bybitApiSecret;

    const bodyObj = { 
      itemId: "2061543132102045696", 
      price: "741.011"
    };
    const bodyStr = JSON.stringify(bodyObj);
    const { timestamp, recvWindow, sign } = signBybit(apiKey, apiSecret, bodyStr);

    const res = await fetch('https://api.bybit.com/v5/p2p/item/update', {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'X-BAPI-API-KEY':     apiKey,
        'X-BAPI-TIMESTAMP':   timestamp,
        'X-BAPI-SIGN':        sign,
        'X-BAPI-SIGN-TYPE':   '2',
        'X-BAPI-RECV-WINDOW': recvWindow,
      },
      body: bodyStr
    });

    const text = await res.text();
    
    // Also try /v1/p2p/item/update or /v5/p2p/item/update with advId
    const bodyObj2 = { 
      advId: "2061543132102045696", 
      price: "741.012"
    };
    const bodyStr2 = JSON.stringify(bodyObj2);
    const sig2 = signBybit(apiKey, apiSecret, bodyStr2);
    const res2 = await fetch('https://api.bybit.com/v5/p2p/item/update', {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'X-BAPI-API-KEY':     apiKey,
        'X-BAPI-TIMESTAMP':   sig2.timestamp,
        'X-BAPI-SIGN':        sig2.sign,
        'X-BAPI-SIGN-TYPE':   '2',
        'X-BAPI-RECV-WINDOW': sig2.recvWindow,
      },
      body: bodyStr2
    });
    
    return NextResponse.json({
       test1_itemId: text,
       test2_advId: await res2.text()
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
