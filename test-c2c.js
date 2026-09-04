const crypto = require('crypto');
const https = require('https');

const API_KEY    = 'pyRpfLpAgBklxVtarZaWWuq1G1ZprO5h4DkDiOQDWwc1NW4MuMyBJNHyBYD9JbVT';
const API_SECRET = 'zJ3Kg8QeUdvA0OPGWaXWMyr0Ad2XueLO6S4aivKwQ17VjkqjL9fAKfsaerTSkHwg';

function sign(qs) { return crypto.createHmac('sha256', API_SECRET).update(qs).digest('hex'); }

async function doReq(path, qsBody, contentType) {
  return new Promise((resolve) => {
    const h = {
      'X-MBX-APIKEY': API_KEY,
      'clientType': 'web',
    };
    if (qsBody) h['Content-Length'] = Buffer.byteLength(qsBody).toString();
    else h['Content-Length'] = '0';
    if (contentType) h['Content-Type'] = contentType;
    
    const r = https.request({
      hostname: 'api.binance.com',
      port: 443,
      path: path,
      method: 'POST',
      headers: h
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ s: res.statusCode, b: d }));
    });
    if (qsBody) r.write(qsBody);
    r.end();
  });
}

async function run() {
  const ts = Date.now();
  const rawParams = 'adOrderNo=22890995150246187008&timestamp=' + ts;
  const sig = sign(rawParams);
  
  console.log('1. JSON:');
  console.log(await doReq('/sapi/v1/c2c/orderMatch/getUserOrderDetail', JSON.stringify({ adOrderNo: '22890995150246187008', timestamp: ts, signature: sig }), 'application/json'));
  
  console.log('\n2. Form-urlencoded (sig inside):');
  console.log(await doReq('/sapi/v1/c2c/orderMatch/getUserOrderDetail', rawParams + '&signature=' + sig, 'application/x-www-form-urlencoded'));

  console.log('\n3. All in Query String, Empty Body:');
  console.log(await doReq('/sapi/v1/c2c/orderMatch/getUserOrderDetail?' + rawParams + '&signature=' + sig, '', 'application/x-www-form-urlencoded'));

  console.log('\n4. All in Query String, No Content-Type:');
  console.log(await doReq('/sapi/v1/c2c/orderMatch/getUserOrderDetail?' + rawParams + '&signature=' + sig, '', ''));
}
run();
