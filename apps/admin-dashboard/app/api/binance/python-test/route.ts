import { NextResponse } from 'next/server';
import { readBinanceKeys, signBinance } from '../_lib/binance';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/binance/python-test
 * Ejecuta LITERALMENTE el código Python que Binance nos envió
 * en su documentación de soporte (Case #161563442)
 */
export async function GET(req: Request) {
  const { apiKey, apiSecret } = readBinanceKeys();
  if (!apiKey || !apiSecret) return NextResponse.json({ error: 'No API key' });

  const url     = new URL(req.url);
  const orderId = url.searchParams.get('orderId') || '';

  // Buscar orden activa
  let orderNo = orderId;
  if (!orderNo) {
    const { serverTime } = await (await fetch('https://api.binance.com/api/v3/time', { cache: 'no-store' })).json();
    const ts  = serverTime.toString();
    const qs  = `tradeType=BUY&page=1&rows=5&timestamp=${ts}`;
    const sig = signBinance(apiSecret, qs);
    const res = await fetch(`https://api.binance.com/sapi/v1/c2c/orderMatch/listUserOrderHistory?${qs}&signature=${sig}`, {
      headers: { 'X-MBX-APIKEY': apiKey }, cache: 'no-store',
    });
    const json = await res.json();
    const orders = json.data || [];
    const active = orders.find((o: any) => ['TRADING', 'PENDING', 'BUY_PENDING', 'BUYER_PAYED'].includes(o.orderStatus));
    orderNo = (active || orders[0])?.orderNumber || '22890812953663692800';
  }

  // ── Script Python EXACTO del código de Binance ────────────────────
  const pythonScript = `
import hashlib
import hmac
import time
import requests
import json
import sys

API_KEY = "${apiKey}"
API_SECRET = "${apiSecret}"
BASE_URL = "https://api.binance.com"

session = requests.Session()
session.headers.update({"X-MBX-APIKEY": API_KEY})

def sign(query_string):
    return hmac.new(API_SECRET.encode("utf-8"), query_string.encode("utf-8"), hashlib.sha256).hexdigest()

results = []

# 1. Verificar tiempo
server_time = session.get(BASE_URL + "/api/v3/time").json()["serverTime"]
local_time = int(time.time() * 1000)
drift = server_time - local_time
results.append({"test": "time_sync", "server": server_time, "local": local_time, "drift_ms": drift})

# 2. GET listUserOrderHistory (CONTROL - debe funcionar)
ts = str(server_time)
qs = f"tradeType=BUY&page=1&rows=3&timestamp={ts}"
sig = sign(qs)
r = session.get(BASE_URL + f"/sapi/v1/c2c/orderMatch/listUserOrderHistory?{qs}&signature={sig}")
results.append({"test": "GET_listHistory", "http": r.status_code, "body": r.json()})

# 3. POST getUserOrderDetail - QS params (como Python session.post con params=)
orderNo = "${orderNo}"

# Variante A: params en query string (session.post(url, params=payload))
for param_name in ["adOrderNo", "orderNo", "orderNumber"]:
    ts = str(int(time.time() * 1000))
    payload = {param_name: orderNo, "timestamp": ts}
    qs = "&".join([f"{k}={v}" for k, v in payload.items()])
    sig = sign(qs)
    url = BASE_URL + f"/sapi/v1/c2c/orderMatch/getUserOrderDetail?{qs}&signature={sig}"
    r = session.post(url)
    results.append({
        "test": f"POST_detail_QS_{param_name}",
        "http": r.status_code,
        "body": r.json() if r.headers.get("content-type","").startswith("application/json") else r.text[:200]
    })

# Variante B: params en body form-urlencoded
for param_name in ["adOrderNo", "orderNo", "orderNumber"]:
    ts = str(int(time.time() * 1000))
    payload = {param_name: orderNo, "timestamp": ts}
    qs = "&".join([f"{k}={v}" for k, v in payload.items()])
    sig = sign(qs)
    data_str = f"{qs}&signature={sig}"
    r = session.post(
        BASE_URL + "/sapi/v1/c2c/orderMatch/getUserOrderDetail",
        data=data_str,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    results.append({
        "test": f"POST_detail_BODY_{param_name}",
        "http": r.status_code,
        "body": r.json() if r.headers.get("content-type","").startswith("application/json") else r.text[:200]
    })

# 4. POST markOrderAsPaid
for param_name in ["orderNumber", "orderNo"]:
    ts = str(int(time.time() * 1000))
    payload = {param_name: orderNo, "payId": "0", "timestamp": ts}
    qs = "&".join([f"{k}={v}" for k, v in payload.items()])
    sig = sign(qs)
    url = BASE_URL + f"/sapi/v1/c2c/orderMatch/markOrderAsPaid?{qs}&signature={sig}"
    r = session.post(url)
    results.append({
        "test": f"POST_markPaid_{param_name}",
        "http": r.status_code,
        "body": r.json() if r.headers.get("content-type","").startswith("application/json") else r.text[:200]
    })

# 5. pre-signed-url
ts = str(int(time.time() * 1000))
qs = f"imageName=test.png&timestamp={ts}"
sig = sign(qs)
r = session.post(
    BASE_URL + "/sapi/v1/c2c/chat/image/pre-signed-url",
    data=f"{qs}&signature={sig}",
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)
results.append({
    "test": "POST_preSignedUrl",
    "http": r.status_code,
    "body": r.json() if r.headers.get("content-type","").startswith("application/json") else r.text[:200]
})

print(json.dumps({"python_version": sys.version, "results": results}, indent=2))
`;

  // Escribir el script y ejecutarlo
  const scriptPath = '/tmp/binance_test.py';
  let pythonOutput = '';
  let pythonError  = '';

  try {
    writeFileSync(scriptPath, pythonScript);
    pythonOutput = execSync(`python3 ${scriptPath} 2>&1`, { timeout: 30000 }).toString();
  } catch (e: any) {
    pythonError = e.stderr?.toString() || e.stdout?.toString() || e.message;
    pythonOutput = e.stdout?.toString() || '';
  }

  let parsed: any = null;
  try { parsed = JSON.parse(pythonOutput); } catch {}

  return NextResponse.json({
    executedWith: 'Python3 (requests library) — código EXACTO de Binance',
    orderNo,
    pythonOutput: parsed || pythonOutput.slice(0, 2000),
    pythonError:  pythonError.slice(0, 500),
    summary: parsed?.results?.map((r: any) => {
      const code = r.body?.code;
      const icon = (code === '000000' || code === 0) ? '✅' : '❌';
      return `${icon} ${r.test}: HTTP ${r.http} code=${code} msg=${(r.body?.msg || r.body?.message || '').slice(0, 80)}`;
    }),
  });
}
