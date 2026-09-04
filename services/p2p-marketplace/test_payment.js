const crypto = require('crypto');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const apiKey = process.env.BYBIT_API_KEY;
  const apiSecret = process.env.BYBIT_API_SECRET;
  const orderId = '2043093404671823872';

  const timestamp = Date.now().toString();
  const recvWindow = '50000';
  const payload = { orderId };
  const payloadStr = JSON.stringify(payload);
  const signText = timestamp + apiKey + recvWindow + payloadStr;
  const sign = crypto.createHmac('sha256', apiSecret).update(signText).digest('hex');

  try {
     const res = await axios.post('https://api.bybit.com/v5/p2p/order/info', payload, {
        headers: {
           'X-BAPI-API-KEY': apiKey,
           'X-BAPI-SIGN': sign,
           'X-BAPI-SIGN-TYPE': '2',
           'X-BAPI-TIMESTAMP': timestamp,
           'X-BAPI-RECV-WINDOW': recvWindow,
           'Content-Type': 'application/json'
        }
     });
     console.log(JSON.stringify(res.data.result.paymentTermList, null, 2));
  } catch (err) {
     console.error(err.response ? err.response.data : err.message);
  }
}
run();
