const axios = require('axios');
const crypto = require('crypto');

const apiKey = 'FohvuxtMziAbpDbedi';
const apiSecret = 'LJ7LtRgoBt7X2yg2NbsA2KVB2k15YTSNLX3V';
const recvWindow = '5000';
const timestamp = Date.now().toString();
const qs = 'accountType=UNIFIED';
const paramStr = timestamp + apiKey + recvWindow + qs;
const signature = crypto.createHmac('sha256', apiSecret).update(paramStr).digest('hex');

axios.get('https://api.bybit.com/v5/account/wallet-balance?' + qs, {
  headers: {
    'X-BAPI-API-KEY': apiKey,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': recvWindow,
    'X-BAPI-SIGN': signature,
    'Content-Type': 'application/json'
  }
}).then(res => console.log('SUCCESS:', JSON.stringify(res.data))).catch(e => console.error('ERROR:', e.response ? JSON.stringify(e.response.data) : e.message));
