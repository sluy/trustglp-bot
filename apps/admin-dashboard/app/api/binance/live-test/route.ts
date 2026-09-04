import { NextResponse } from 'next/server';
import { readBinanceKeys, signBinance } from '../_lib/binance';
import * as https from 'https';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

export const dynamic = 'force-dynamic';

function httpsReq(method: string, path: string, headers: Record<string, string>, body?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.binance.com', port: 443, path, method,
      headers: { ...headers, 'Content-Length': body ? Buffer.byteLength(body).toString() : '0' },
    };
    const r = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode!, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode!, body: { raw: data.slice(0, 500) } }); }
      });
    });
    r.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
    if (body) r.write(body);
    r.end();
  });
}

export async function GET(req: Request) {
  const { apiKey, apiSecret } = readBinanceKeys();
  if (!apiKey || !apiSecret) return NextResponse.json({ error: 'No API key' });

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') || 'all'; // 'all', 'python', 'node'

  const { serverTime } = await (await fetch('https://api.binance.com/api/v3/time', { cache: 'no-store' })).json();
  const baseH = { 'X-MBX-APIKEY': apiKey, 'User-Agent': 'python-requests/2.31.0', 'Accept': '*/*', 'Connection': 'keep-alive' };

  // Buscar orden
  let counter = 0;
  const ts = () => (serverTime + (counter++)).toString();
  const qs0 = `tradeType=BUY&page=1&rows=5&timestamp=${ts()}`;
  const listRes = await fetch(`https://api.binance.com/sapi/v1/c2c/orderMatch/listUserOrderHistory?${qs0}&signature=${signBinance(apiSecret, qs0)}`, {
    headers: { 'X-MBX-APIKEY': apiKey }, cache: 'no-store',
  });
  const orders = ((await listRes.json()).data || []) as any[];
  const active = orders.find((o: any) => ['TRADING', 'PENDING', 'BUY_PENDING', 'BUYER_PAYED'].includes(o.orderStatus));
  const target = active || orders[0] || {};
  const orderNumber = target.orderNumber || '';

  const nodeResults: string[] = [];
  nodeResults.push(`📋 Orden: ${orderNumber} [${target.orderStatus}]`);

  // ═══════════════════════════════════════════════════════════════
  // PARTE 1: Node.js tests
  // ═══════════════════════════════════════════════════════════════
  if (mode === 'all' || mode === 'node') {
    for (const [key, val] of [['adOrderNo', orderNumber], ['orderNo', orderNumber], ['orderNumber', orderNumber]]) {
      const t = ts();
      const qs = `${key}=${val}&timestamp=${t}`;
      const sig = signBinance(apiSecret, qs);
      const r = await httpsReq('POST', `/sapi/v1/c2c/orderMatch/getUserOrderDetail?${qs}&signature=${sig}`, { ...baseH, 'Content-Length': '0' });
      nodeResults.push(`❌ Node detail ${key} → HTTP ${r.status} code=${r.body.code} msg=${(r.body.msg || '').slice(0, 60)}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PARTE 2: Python3 (requests library) — CÓDIGO DE BINANCE
  // ═══════════════════════════════════════════════════════════════
  let pythonResult: any = { executed: false };

  if (mode === 'all' || mode === 'python') {
    const script = `
import hashlib, hmac, time, json, sys
try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests not installed", "fix": "pip3 install requests"}))
    sys.exit(0)

API_KEY = "${apiKey}"
API_SECRET = "${apiSecret}"
BASE = "https://api.binance.com"

s = requests.Session()
s.headers.update({"X-MBX-APIKEY": API_KEY})

def sign(qs):
    return hmac.new(API_SECRET.encode(), qs.encode(), hashlib.sha256).hexdigest()

out = []

# Time sync
st = s.get(BASE + "/api/v3/time").json()["serverTime"]
out.append({"t": "time", "drift": st - int(time.time()*1000)})

# GET control
ts = str(st)
qs = f"tradeType=BUY&page=1&rows=1&timestamp={ts}"
r = s.get(BASE + f"/sapi/v1/c2c/orderMatch/listUserOrderHistory?{qs}&signature={sign(qs)}")
out.append({"t": "GET_list", "http": r.status_code, "code": r.json().get("code"), "ok": r.json().get("code") == "000000"})

orderNo = "${orderNumber}"

# POST getUserOrderDetail with params= (Python way)
for pname in ["adOrderNo", "orderNo", "orderNumber"]:
    ts = str(int(time.time()*1000))
    payload = {pname: orderNo, "timestamp": ts}
    qs = "&".join(f"{k}={v}" for k,v in payload.items())
    sig = sign(qs)
    r = s.post(BASE + f"/sapi/v1/c2c/orderMatch/getUserOrderDetail?{qs}&signature={sig}")
    j = r.json()
    out.append({"t": f"POST_detail_{pname}", "http": r.status_code, "code": j.get("code"), "msg": str(j.get("msg",""))[:80]})

# POST markOrderAsPaid
for pname in ["orderNumber", "orderNo"]:
    ts = str(int(time.time()*1000))
    payload = {pname: orderNo, "payId": "0", "timestamp": ts}
    qs = "&".join(f"{k}={v}" for k,v in payload.items())
    sig = sign(qs)
    r = s.post(BASE + f"/sapi/v1/c2c/orderMatch/markOrderAsPaid?{qs}&signature={sig}")
    j = r.json()
    out.append({"t": f"POST_markPaid_{pname}", "http": r.status_code, "code": j.get("code"), "msg": str(j.get("msg",""))[:80]})

# pre-signed
ts = str(int(time.time()*1000))
qs = f"imageName=test.png&timestamp={ts}"
sig = sign(qs)
r = s.post(BASE + f"/sapi/v1/c2c/chat/image/pre-signed-url?{qs}&signature={sig}")
j = r.json()
out.append({"t": "POST_presigned", "http": r.status_code, "code": j.get("code"), "msg": str(j.get("msg",""))[:80]})

print(json.dumps({"v": sys.version, "results": out}))
`;

    const scriptPath = '/tmp/btest.py';
    try {
      writeFileSync(scriptPath, script);
      const raw = execSync(`python3 ${scriptPath} 2>&1`, { timeout: 45000 }).toString().trim();
      pythonResult = JSON.parse(raw);
      pythonResult.executed = true;
    } catch (e: any) {
      pythonResult = {
        executed: false,
        error: e.message?.slice(0, 200),
        stdout: e.stdout?.toString()?.slice(0, 500),
        stderr: e.stderr?.toString()?.slice(0, 500),
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Formatear resultado Python
  // ═══════════════════════════════════════════════════════════════
  const pythonSummary = pythonResult.results?.map((r: any) => {
    const icon = (r.code === '000000' || r.code === 0 || r.ok) ? '✅' : '❌';
    return `${icon} Python ${r.t}: HTTP ${r.http} code=${r.code} msg=${r.msg || ''}`;
  }) || [];

  return NextResponse.json({
    serverTime,
    drift: serverTime - Date.now(),
    order: { no: orderNumber, status: target.orderStatus },
    nodeResults,
    python: {
      version: pythonResult.v,
      executed: pythonResult.executed,
      error: pythonResult.error,
      results: pythonResult.results,
      summary: pythonSummary,
    },
  });
}
