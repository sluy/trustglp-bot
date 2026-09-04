const https = require('https');
const crypto = require('crypto');

const API_KEY    = 'Dx0IplzHSt8X3i5LJwjFkAlKPWIl46LcPGNhpGHdVm2rt6b08C0CePkQU6sPPU1m';
const API_SECRET = '6drd8TXQ1DFUcbs6MKQrai79UkMkVZoKKzSMETvg2VKPj4l8x6FhA2GiPVUs6MbC';

function sign(qs) { return crypto.createHmac('sha256', API_SECRET).update(qs).digest('hex'); }

function doReq(method, path, headers, body) {
  return new Promise((resolve) => {
    const h = { ...headers };
    if (body) h['Content-Length'] = Buffer.byteLength(body).toString();
    else if (method === 'POST') h['Content-Length'] = '0';
    const r = https.request({ hostname: 'api.binance.com', port: 443, path, method, headers: h }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, b: JSON.parse(d) }); } catch { resolve({ s: res.statusCode, b: d.slice(0,300) }); } });
    });
    r.on('error', (e) => resolve({ s: 0, b: e.message }));
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  const t = await doReq('GET', '/api/v3/time', {});
  const st = t.b.serverTime;
  let c = 0;
  const ts = () => (st + (c++)).toString();
  console.log(`Binance time: ${st}, drift: ${st - Date.now()}ms\n`);

  // GET headers (sin Content-Type para GET)
  const getH = { 'X-MBX-APIKEY': API_KEY, 'clientType': 'web' };

  // Buscar ordenes
  const qs0 = `tradeType=BUY&page=1&rows=5&timestamp=${ts()}`;
  const list = await doReq('GET', `/sapi/v1/c2c/orderMatch/listUserOrderHistory?${qs0}&signature=${sign(qs0)}`, getH);
  const orders = list.b.data || [];
  const active = orders.find(o => ['TRADING','PENDING','BUY_PENDING','BUYER_PAYED'].includes(o.orderStatus));
  const tgt = active || orders[0];
  orders.forEach(o => {
    const m = ['TRADING','PENDING','BUY_PENDING','BUYER_PAYED'].includes(o.orderStatus) ? '🔥' : '  ';
    console.log(`${m} ${o.orderNumber} [${o.orderStatus}] ${o.amount} ${o.asset}`);
  });
  const orderNo = tgt?.orderNumber || '22890812953663692800';
  console.log(`\n🎯 Testing: ${orderNo} [${tgt?.orderStatus || 'fallback'}]\n`);

  // POST headers con clientType
  const postH = {
    'X-MBX-APIKEY':    API_KEY,
    'clientType':      'web',
    'Content-Type':    'application/x-www-form-urlencoded',
    'User-Agent':      'python-requests/2.31.0',
    'Accept':          '*/*',
    'Connection':      'keep-alive',
  };

  // ═══ ESTRATEGIA A: Params en BODY, signature en BODY ═══
  console.log('═══ ESTRATEGIA A: Body form-urlencoded (params+sig en body) ═══');
  for (const key of ['adOrderNo', 'orderNo', 'orderNumber']) {
    const t1 = ts();
    const qs = `${key}=${orderNo}&timestamp=${t1}`;
    const sig = sign(qs);
    const body = `${qs}&signature=${sig}`;
    console.log(`  body enviado: ${body}`);
    const r = await doReq('POST', '/sapi/v1/c2c/orderMatch/getUserOrderDetail', postH, body);
    const ok = (r.b.code === '000000' || r.b.code === 0);
    console.log(`${ok?'✅':'❌'} ${key.padEnd(15)} → HTTP ${r.s} code=${r.b.code} msg=${(r.b.msg||'').slice(0,80)}`);
    if (ok && r.b.data) console.log(`   🎉 DATA: ${JSON.stringify(r.b.data).slice(0,300)}`);
    console.log('');
  }

  // ═══ ESTRATEGIA B: Params en BODY, signature en QS ═══
  console.log('═══ ESTRATEGIA B: Params en body, signature en query string ═══');
  for (const key of ['adOrderNo', 'orderNo', 'orderNumber']) {
    const t1 = ts();
    const qs = `${key}=${orderNo}&timestamp=${t1}`;
    const sig = sign(qs);
    const body = qs;  // Sin signature en el body
    const path = `/sapi/v1/c2c/orderMatch/getUserOrderDetail?signature=${sig}`;
    console.log(`  path: ${path}`);
    console.log(`  body: ${body}`);
    const r = await doReq('POST', path, postH, body);
    const ok = (r.b.code === '000000' || r.b.code === 0);
    console.log(`${ok?'✅':'❌'} ${key.padEnd(15)} → HTTP ${r.s} code=${r.b.code} msg=${(r.b.msg||'').slice(0,80)}`);
    if (ok && r.b.data) console.log(`   🎉 DATA: ${JSON.stringify(r.b.data).slice(0,300)}`);
    console.log('');
  }

  // ═══ ESTRATEGIA C: TODO en QS con clientType ═══
  console.log('═══ ESTRATEGIA C: Todo en query string + clientType + Content-Length:0 ═══');
  for (const key of ['adOrderNo', 'orderNo', 'orderNumber']) {
    const t1 = ts();
    const qs = `${key}=${orderNo}&timestamp=${t1}`;
    const sig = sign(qs);
    const path = `/sapi/v1/c2c/orderMatch/getUserOrderDetail?${qs}&signature=${sig}`;
    const r = await doReq('POST', path, { ...postH, 'Content-Length': '0' });
    const ok = (r.b.code === '000000' || r.b.code === 0);
    console.log(`${ok?'✅':'❌'} ${key.padEnd(15)} → HTTP ${r.s} code=${r.b.code} msg=${(r.b.msg||'').slice(0,80)}`);
    if (ok && r.b.data) console.log(`   🎉 DATA: ${JSON.stringify(r.b.data).slice(0,300)}`);
  }

  // ═══ ESTRATEGIA D: Body + sin Content-Type ═══
  console.log('\n═══ ESTRATEGIA D: Body sin Content-Type (raw) + clientType ═══');
  {
    const t1 = ts();
    const qs = `adOrderNo=${orderNo}&timestamp=${t1}`;
    const sig = sign(qs);
    const body = `${qs}&signature=${sig}`;
    const hNoContentType = { 'X-MBX-APIKEY': API_KEY, 'clientType': 'web', 'User-Agent': 'python-requests/2.31.0', 'Accept': '*/*' };
    const r = await doReq('POST', '/sapi/v1/c2c/orderMatch/getUserOrderDetail', hNoContentType, body);
    const ok = (r.b.code === '000000' || r.b.code === 0);
    console.log(`${ok?'✅':'❌'} adOrderNo (raw) → HTTP ${r.s} code=${r.b.code} msg=${(r.b.msg||'').slice(0,80)}`);
    if (ok && r.b.data) console.log(`   🎉 DATA: ${JSON.stringify(r.b.data).slice(0,300)}`);
  }

  // ═══ markOrderAsPaid con clientType (body) ═══
  console.log('\n═══ markOrderAsPaid (body + clientType) ═══');
  for (const p of [`orderNumber=${orderNo}&payId=0`, `orderNo=${orderNo}&payId=0`]) {
    const t1 = ts();
    const qs = `${p}&timestamp=${t1}`;
    const sig = sign(qs);
    const body = `${qs}&signature=${sig}`;
    const r = await doReq('POST', '/sapi/v1/c2c/orderMatch/markOrderAsPaid', postH, body);
    const ok = (r.b.code === '000000' || r.b.code === 0);
    console.log(`${ok?'✅':'❌'} ${p.slice(0,40).padEnd(42)} → HTTP ${r.s} code=${r.b.code} msg=${(r.b.msg||'').slice(0,80)}`);
    if (ok) console.log(`   🎉 DATA: ${JSON.stringify(r.b.data).slice(0,300)}`);
  }

  // ═══ pre-signed-url ═══
  console.log('\n═══ pre-signed-url (body + clientType) ═══');
  {
    const t1 = ts();
    const qs = `imageName=test.png&timestamp=${t1}`;
    const sig = sign(qs);
    const r = await doReq('POST', '/sapi/v1/c2c/chat/image/pre-signed-url', postH, `${qs}&signature=${sig}`);
    const ok = (r.b.code === '000000' || r.b.code === 0);
    console.log(`${ok?'✅':'❌'} pre-signed-url → HTTP ${r.s} code=${r.b.code} msg=${(r.b.msg||'')}`);
    if (ok) console.log(`   🎉 DATA: ${JSON.stringify(r.b.data).slice(0,300)}`);
  }

  console.log('\n✅ Test completo');
}

main().catch(console.error);
