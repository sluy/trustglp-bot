const https = require('https');
const crypto = require('crypto');
const API_KEY    = 'Dx0IplzHSt8X3i5LJwjFkAlKPWIl46LcPGNhpGHdVm2rt6b08C0CePkQU6sPPU1m';
const API_SECRET = '6drd8TXQ1DFUcbs6MKQrai79UkMkVZoKKzSMETvg2VKPj4l8x6FhA2GiPVUs6MbC';
function sign(qs) { return crypto.createHmac('sha256', API_SECRET).update(qs).digest('hex'); }
function doReq(path, bodyStr, contentType) {
  return new Promise((resolve) => {
    const h = { 'X-MBX-APIKEY': API_KEY, 'clientType': 'web' };
    if (contentType) h['Content-Type'] = contentType;
    if (bodyStr) h['Content-Length'] = Buffer.byteLength(bodyStr).toString();
    else h['Content-Length'] = '0';
    const r = https.request({ hostname: 'api.binance.com', port: 443, path, method: 'POST', headers: h }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, b: JSON.parse(d) }); } catch { resolve({ s: res.statusCode, b: d }); } });
    });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}
async function test() {
  const t = await new Promise(r => https.get('https://api.binance.com/api/v3/time', res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>r(JSON.parse(d))); }));
  const ts = t.serverTime;
  const orderNo = '22890848812383031296';
  
  // V1: everything in JSON body
  let qs1 = `adOrderNo=${orderNo}&timestamp=${ts}`;
  let b1 = JSON.stringify({ adOrderNo: orderNo, timestamp: ts, signature: sign(qs1) });
  let r1 = await doReq('/sapi/v1/c2c/orderMatch/getUserOrderDetail', b1, 'application/json');
  console.log('V1 (JSON body with sig):', r1.s, r1.b);

  // V2: payload in JSON body, timestamp+sig in query string
  let qs2 = `adOrderNo=${orderNo}&timestamp=${ts}`; 
  let b2 = JSON.stringify({ adOrderNo: orderNo });
  let r2 = await doReq(`/sapi/v1/c2c/orderMatch/getUserOrderDetail?timestamp=${ts}&signature=${sign(qs2)}`, b2, 'application/json');
  console.log('V2 (JSON body, sig in qs):', r2.s, r2.b);

  // V3: Form urlencoded
  let qs3 = `adOrderNo=${orderNo}&timestamp=${ts}`;
  let b3 = `${qs3}&signature=${sign(qs3)}`;
  let r3 = await doReq('/sapi/v1/c2c/orderMatch/getUserOrderDetail', b3, 'application/x-www-form-urlencoded');
  console.log('V3 (Form body):', r3.s, r3.b);

  // V4: All in query string
  let qs4 = `adOrderNo=${orderNo}&timestamp=${ts}`;
  let r4 = await doReq(`/sapi/v1/c2c/orderMatch/getUserOrderDetail?${qs4}&signature=${sign(qs4)}`, '', 'application/json');
  console.log('V4 (Query string, JSON CT):', r4.s, r4.b);

  // V5: All in query string, form CT
  let r5 = await doReq(`/sapi/v1/c2c/orderMatch/getUserOrderDetail?${qs4}&signature=${sign(qs4)}`, '', 'application/x-www-form-urlencoded');
  console.log('V5 (Query string, Form CT):', r5.s, r5.b);
  
  // V6: All in query string, no CT
  let r6 = await doReq(`/sapi/v1/c2c/orderMatch/getUserOrderDetail?${qs4}&signature=${sign(qs4)}`, '', '');
  console.log('V6 (Query string, No CT):', r6.s, r6.b);
  
  // V7: getDetailByNo with JSON
  let qs7 = `adsNo=${orderNo}&timestamp=${ts}`;
  let b7 = JSON.stringify({ adsNo: orderNo, timestamp: ts, signature: sign(qs7) });
  let r7 = await doReq('/sapi/v1/c2c/ads/getDetailByNo', b7, 'application/json');
  console.log('V7 (getDetailByNo JSON):', r7.s, r7.b);

  // V8: getDetailByNo with Query String
  let r8 = await doReq(`/sapi/v1/c2c/ads/getDetailByNo?${qs7}&signature=${sign(qs7)}`, '', 'application/x-www-form-urlencoded');
  console.log('V8 (getDetailByNo QS):', r8.s, r8.b);
}
test();
