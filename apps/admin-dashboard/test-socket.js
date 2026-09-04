const { io } = require("socket.io-client");

const WEBSOCKET_URL = 'https://agencia-ia-core-order-manager.jkmm2u.easypanel.host';
const socket = io(WEBSOCKET_URL, {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected to websocket server');
});

socket.on('bybitMarketUpdate', (data) => {
  console.log('--- bybitMarketUpdate received ---');
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout waiting for data');
  process.exit(1);
}, 15000);
