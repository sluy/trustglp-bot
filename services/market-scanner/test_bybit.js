const https = require('https');

const data = JSON.stringify({
    userId: "",
    tokenId: "USDT",
    currencyId: "VES",
    payment: [],
    side: "1",
    size: "10",
    page: "1",
    amount: "100",
    authMaker: false,
    canTrade: false
});

const options = {
    hostname: 'api2.bybit.com',
    port: 443,
    path: '/fiat/otc/item/online',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        try {
            console.log(body.substring(0, 1000));
        } catch (e) {
            console.log(e);
        }
    });
});
req.on('error', error => console.error(error));
req.write(data);
req.end();
