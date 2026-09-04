const crypto = require('crypto');
const fs = require('fs');

const keys = JSON.parse(fs.readFileSync('C:/Users/sebas/Desktop/agenteInteligente/quant-global/data/api_keys.json'));
const apiKey = keys.binanceApiKey;
const apiSecret = keys.binanceApiSecret;

function sign(queryString) {
  return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

async function getOrder() {
  const timestamp = Date.now().toString();
  // We want to check order 22896263656427229184
  // Let's just fetch recent orders and find it
  for (const tradeType of ['BUY', 'SELL']) {
    const params = `tradeType=${tradeType}&page=1&rows=10&timestamp=${timestamp}`;
    const signature = sign(params);
    const url = `https://api.binance.com/sapi/v1/c2c/orderMatch/listUserOrderHistory?${params}&signature=${signature}`;
    
    const res = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey } });
    const data = await res.json();
    if (data.data) {
      for (const o of data.data) {
        console.log(`Type: ${tradeType}, Order: ${o.orderNumber}, Amount: ${o.amount}, TotalPrice: ${o.totalPrice}, Status: ${o.orderStatus}`);
      }
    }
  }
}

getOrder().catch(console.error);
