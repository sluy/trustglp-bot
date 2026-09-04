require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

async function test() {
  const apiKey = process.env.BYBIT_MASTER_API_KEY;
  const apiSecret = process.env.BYBIT_MASTER_API_SECRET;
  if(!apiKey) { console.log("No api key"); return; }
  
  const payload = { orderId: "2044505880829755392" };
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const signText = timestamp + apiKey + recvWindow + JSON.stringify(payload);
  const sign = crypto.createHmac('sha256', apiSecret).update(signText).digest('hex');
  
  try {
    const res = await axios.post("https://api.bybit.com/v5/p2p/order/info", payload, {
      headers: {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-SIGN': sign,
        'X-BAPI-SIGN-TYPE': '2',
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'Content-Type': 'application/json'
      }
    });
    console.log("Success:", JSON.stringify(res.data));
  } catch(e) {
    console.error("Error:", e.response ? JSON.stringify(e.response.data) : e.message);
  }
}
test();
