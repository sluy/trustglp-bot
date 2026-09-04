import crypto from 'crypto';

const apiKey = 'HPX0pcKzJqW083RVV5';
const apiSecret = 'GXam2dGdBbZIkom3q6BF274X0ApRimcEJAjU';

function signBybit(apiKey: string, apiSecret: string, body: string) {
  const timestamp  = Date.now().toString();
  const recvWindow = '50000';
  const preSign    = timestamp + apiKey + recvWindow + body;
  const sign       = crypto.createHmac('sha256', apiSecret).update(preSign).digest('hex');
  return { timestamp, recvWindow, sign };
}

async function run() {
  const bodyObj = { 
    itemId: "2061543132102045696", 
    price: "741.011"
  };
  const bodyStr = JSON.stringify(bodyObj);
  const { timestamp, recvWindow, sign } = signBybit(apiKey, apiSecret, bodyStr);

  const res = await fetch('https://api.bybit.com/v5/p2p/item/update', {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'X-BAPI-API-KEY':     apiKey,
      'X-BAPI-TIMESTAMP':   timestamp,
      'X-BAPI-SIGN':        sign,
      'X-BAPI-SIGN-TYPE':   '2',
      'X-BAPI-RECV-WINDOW': recvWindow,
    },
    body: bodyStr
  });

  const text = await res.text();
  console.log("UPDATE RESPONSE:", text);

  // Check info
  const infoObj = { itemId: "2061543132102045696" };
  const infoStr = JSON.stringify(infoObj);
  const sigInfo = signBybit(apiKey, apiSecret, infoStr);

  const resInfo = await fetch('https://api.bybit.com/v5/p2p/item/info', {
    method: 'POST',
    headers: {
      'Content-Type':       'application/json',
      'X-BAPI-API-KEY':     apiKey,
      'X-BAPI-TIMESTAMP':   sigInfo.timestamp,
      'X-BAPI-SIGN':        sigInfo.sign,
      'X-BAPI-SIGN-TYPE':   '2',
      'X-BAPI-RECV-WINDOW': sigInfo.recvWindow,
    },
    body: infoStr
  });
  
  console.log("INFO RESPONSE:", await resInfo.text());
}

run();
