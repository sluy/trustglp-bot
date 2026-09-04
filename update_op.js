const fs = require('fs');

let file = fs.readFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', 'utf8');

const injectMethod = `
  const handleReleaseOrder = async (orderId: string) => {
      const confirmAction = confirm(\`¿Seguro que deseas liberar la orden \${orderId}? Volverá al Order Book para que otro operador pueda tomarla.\`);
      if(confirmAction) {
         try {
            const res = await fetch(\`/api/orders/assignments?orderId=\${orderId}\`, {
               method: 'DELETE'
            });

            if(res.ok) {
               alert(\`Orden \${orderId} liberada correctamente.\`);
               fetchOrders();
            } else {
               alert('Ocurrió un error al liberar la orden.');
            }
         } catch(e) {
            alert('Error de conexión con el servidor.');
         }
      }
  };

  const handleMarkAsPaid = async (orderId: string) => {`;

file = file.replace('  const handleMarkAsPaid = async (orderId: string) => {', injectMethod);

const oldButtons = `<button 
                               onClick={() => handleViewPaymentDetails((o.bybitOrderId || o.binanceOrderId))}
                               className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded shadow transition-all flex items-center gap-2"
                           >
                              <Eye className="w-4 h-4"/> Ver Pago
                           </button>
                           <button 
                               onClick={() => handleMarkAsPaid((o.bybitOrderId || o.binanceOrderId))}
                               className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded shadow transition-all"
                           >
                              Ya Transferí
                           </button>`;

const newButtons = `<button 
                               onClick={() => handleViewPaymentDetails((o.bybitOrderId || o.binanceOrderId))}
                               className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded shadow transition-all flex items-center gap-2"
                           >
                              <Eye className="w-4 h-4"/> Ver Detalle
                           </button>
                           <button 
                               onClick={() => handleReleaseOrder((o.bybitOrderId || o.binanceOrderId))}
                               className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-4 rounded shadow transition-all flex items-center gap-2"
                           >
                              Liberar Orden
                           </button>`;

file = file.replace(oldButtons, newButtons);

fs.writeFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', file);
console.log('Update Complete');
