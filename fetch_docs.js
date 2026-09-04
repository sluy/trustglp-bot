const https = require('https');

https.get('https://bybit-exchange.github.io/docs/p2p/guide', (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
     const links = body.match(/href="(\/docs\/p2p\/[^"]+)"/g);
     if (links) {
         const uniqueLinks = Array.from(new Set(links));
         console.log(uniqueLinks.join('\n'));
     } else {
         console.log("No links found");
     }
  });
}).on('error', e => console.error(e));
