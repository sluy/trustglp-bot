const fs = require('fs');

let code = fs.readFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', 'utf8');

const startStr = 'myAssigned.push(o);';
const endStr = '  const handleMarkAsPaid = async (orderId: string) => {';

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find start or end bounds!");
    process.exit(1);
}

const correctCode = `myAssigned.push(o);
           }
        }
        pending.push(o); // Todo va al Order Book general
      });

      setAssignedOrders(myAssigned as any);
      setOrders(pending as any);

    } catch (e) {
      console.error("Error fetching orders:", e);
    }
  };

  useEffect(() => {
    if (!profile.id) return;
    fetchOrders();
    const int = setInterval(fetchOrders, 10000);
    return () => clearInterval(int);
  }, [profile.id]);

  const handleTakeOrder = async (orderId: string) => {
      const confirmAction = confirm(\`¿Deseas tomar la orden \${orderId} y realizar el pago Fiat?\`);
      if(confirmAction) {
         try {
            const res = await fetch(\`/api/orders/assignments\`, {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ orderId, operatorId: profile.id, operatorName: profile.alias })
            });

            if(res.ok) {
               alert(\`Orden \${orderId} asignada. Revisa tus pagos pendientes y transfiere.\`);
               fetchOrders();
            } else {
               alert('Ocurrió un error al asignar la orden.');
            }
         } catch(e) {
            alert('Error de conexión con el servidor.');
         }
      }
  };

`;

code = code.slice(0, startIdx) + correctCode + code.slice(endIdx);

fs.writeFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', code);
console.log("Mangled code fixed successfully!");
