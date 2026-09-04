const url = 'https://api2.bybit.com/fiat/otc/item/online';
const payload = {
    tokenId: 'USDT',
    currencyId: 'VES',
    payment: [],  
    side: '0',
    size: '10',
    page: '1',
    authMaker: true,
    canTrade: false,
    amount: '80000'
};

fetch(url, {
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
})
.then(r => r.json())
.then(data => {
    const items = data.result.items;
    items.forEach(item => {
        console.log(`${item.nickName}: price ${item.price}, payments ${item.payments.join(',')}`);
    });
});
