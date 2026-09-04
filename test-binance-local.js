const https = require('https');
const crypto = require('crypto');

const API_KEY    = 'Dx0IplzHSt8X3i5LJwjFkAlKPWIl46LcPGNhpGHdVm2rt6b08C0CePkQU6sPPU1m';
const API_SECRET = '6drd8TXQ1DFUcbs6MKQrai79UkMkVZoKKzSMETvg2VKPj4l8x6FhA2GiPVUs6MbC';

function sign(qs) { return crypto.createHmac('sha256', API_SECRET).update(qs).digest('hex'); }

function req(method, path, headers, body) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.binance.com', port: 443, path, method,
      headers: { ...headers, 'Content-Length': body ? Buffer.byteLength(body).toString() : '0' },
    };
    const r = https.request(opts, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, b: JSON.parse(d) }); }
        catch { resolve({ s: res.statusCode, b: d.slice(0, 300) }); }
      });
    });
    r.on('error', (e) => resolve({ s: 0, b: e.message }));
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  const H = { 'X-MBX-APIKEY': API_KEY, 'clientType': 'web', 'User-Agent': 'python-requests/2.31.0', 'Accept': '*/*', 'Connection': 'keep-alive' };

  // 1. Binance time
  const t = await req('GET', '/api/v3/time', {});
  const st = t.b.serverTime;
  console.log(`Binance time: ${st}, drift: ${st - Date.now()}ms\n`);

  // 2. GET control
  let c = 0;
  const ts = () => (st + (c++)).toString();
  const qs0 = `tradeType=BUY&page=1&rows=5&timestamp=${ts()}`;
  const list = await req('GET', `/sapi/v1/c2c/orderMatch/listUserOrderHistory?${qs0}&signature=${sign(qs0)}`, H);
  const orders = list.b.data || [];
  const active = orders.find(o => ['TRADING','PENDING','BUY_PENDING','BUYER_PAYED'].includes(o.orderStatus));
  const tgt = active || orders[0];
  console.log('=== ORDENES ===');
  orders.forEach(o => {
    const m = ['TRADING','PENDING','BUY_PENDING','BUYER_PAYED'].includes(o.orderStatus) ? '🔥' : '  ';
    console.log(`${m} ${o.orderNumber} [${o.orderStatus}] ${o.amount} ${o.asset}`);
  });
  const orderNo = tgt?.orderNumber || '';
  console.log(`\n🎯 Testing: ${orderNo} [${tgt?.orderStatus}]\n`);

  // 3. getUserOrderDetail — JSON Body
  console.log('═══ getUserOrderDetail (JSON) ═══');
  for (const key of ['adOrderNo', 'orderNo', 'orderNumber', 'orderId']) {
    const payload = { [key]: orderNo, timestamp: Number(ts()) };
    const qs = Object.entries(payload).map(([k,v]) => `${k}=${v}`).join('&');
    const sig = sign(qs);
    payload.signature = sig;
    const r = await req('POST', '/sapi/v1/c2c/orderMatch/getUserOrderDetail', {...H,'Content-Type':'application/json'}, JSON.stringify(payload));
    const ok = (r.b.code === '000000' || r.b.code === 0);
    console.log(`${ok?'✅':'❌'} JSON ${key.padEnd(15)} → HTTP ${r.s} code=${r.b.code} msg=${(r.b.msg||'').slice(0,60)}`);
  }

  // 4. markOrderAsPaid — JSON Body
  console.log('\n═══ markOrderAsPaid (JSON) ═══');
  for (const key of ['orderNumber', 'orderNo']) {
    const payload = { [key]: orderNo, payId: 0, timestamp: Number(ts()) };
    const qs = Object.entries(payload).map(([k,v]) => `${k}=${v}`).join('&');
    const sig = sign(qs);
    payload.signature = sig;
    const r = await req('POST', '/sapi/v1/c2c/orderMatch/markOrderAsPaid', {...H,'Content-Type':'application/json'}, JSON.stringify(payload));
    const ok = (r.b.code === '000000' || r.b.code === 0);
    console.log(`${ok?'✅':'❌'} JSON ${key.padEnd(15)} → HTTP ${r.s} code=${r.b.code} msg=${(r.b.msg||'').slice(0,60)}`);
  }

  // 5. pre-signed-url — JSON Body
  console.log('\n═══ pre-signed-url (JSON) ═══');
  const p5 = { imageName: 'test.png', timestamp: Number(ts()) };
  const qs5 = Object.entries(p5).map(([k,v]) => `${k}=${v}`).join('&');
  p5.signature = sign(qs5);
  const r5 = await req('POST', '/sapi/v1/c2c/chat/image/pre-signed-url', {...H,'Content-Type':'application/json'}, JSON.stringify(p5));
  console.log(`${r5.b.code==='000000'?'✅':'❌'} pre-signed-url → HTTP ${r5.s} code=${r5.b.code} msg=${(r5.b.msg||'')}`);
  if (r5.b.data) console.log(`   DATA: ${JSON.stringify(r5.b.data).slice(0,300)}`);

  // 6. API permissions
  console.log('\n═══ API Key Permissions ═══');
  const t6 = ts();
  const qs6 = `timestamp=${t6}`;
  const r6 = await req('GET', `/sapi/v1/account/apiRestrictions?${qs6}&signature=${sign(qs6)}`, H);
  if (r6.b && typeof r6.b === 'object') {
    Object.entries(r6.b).forEach(([k,v]) => {
      if (typeof v === 'boolean') console.log(`   ${v?'✅':'⬜'} ${k}: ${v}`);
    });
  }

  console.log('\n✅ Test completo desde IP LOCAL');
}

main().catch(console.error);
