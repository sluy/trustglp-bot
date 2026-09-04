const fs = require('fs');
const data = JSON.parse(fs.readFileSync('bybit.json', 'utf8'));
const items = data.result.items;
const paymentIds = new Set();
items.forEach(item => {
    item.payments.forEach(p => paymentIds.add(p));
});
console.log('Payment IDs:', Array.from(paymentIds));
