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
  
  // pre-signed-url JSON
  let qs1 = `imageName=test.png&timestamp=${ts}`;
  let b1 = JSON.stringify({ imageName: 'test.png', timestamp: ts, signature: sign(qs1) });
  let r1 = await doReq('/sapi/v1/c2c/chat/image/pre-signed-url', b1, 'application/json');
  console.log('pre-signed-url JSON:', r1.s, r1.b);

  // pre-signed-url Form
  let b2 = `${qs1}&signature=${sign(qs1)}`;
  let r2 = await doReq('/sapi/v1/c2c/chat/image/pre-signed-url', b2, 'application/x-www-form-urlencoded');
  console.log('pre-signed-url Form:', r2.s, r2.b);
}
test();
