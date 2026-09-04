const fs = require('fs');
let file = fs.readFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', 'utf8');
file = file.replace('onClick={() => handleMarkAsPaid((o.bybitOrderId || o.binanceOrderId))}','onClick={() => handleReleaseOrder((o.bybitOrderId || o.binanceOrderId))}');
fs.writeFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', file);
console.log('Done');
