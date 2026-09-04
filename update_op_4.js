const fs = require('fs');

let file = fs.readFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', 'utf8');

const startIndex = file.indexOf('const handleViewPaymentDetails = async (orderId: string) => {');
const endIndex = file.indexOf('const chatPollRef = useRef<NodeJS.Timeout | null>(null);');

if (startIndex === -1 || endIndex === -1) {
   console.log('Failed to find indices');
   process.exit(1);
}

const newMethod = `  const handleViewPaymentDetails = async (o: any) => {
    setSelectedOrderDetails({ ...o, counterparty: null });
    setLoadingDetails(true);

    try {
      if (o.exchange === 'bybit' || !o.exchange) {
        const res = await fetch(\`/api/bybit/order/\${o.bybitOrderId || o.orderId}\`);
        if (res.ok) {
          const data = await res.json();
          setSelectedOrderDetails({ ...o, counterparty: data });
        } else {
          setSelectedOrderDetails({ ...o, counterparty: { result: null, error: 'Error al conectar con Bybit' } });
        }
      } else {
        const amountFiat = o.amountFiat || o.amount || '';
        setSelectedOrderDetails({
          ...o,
          amountFiat,
          counterparty: {
            result: {
              buyerRealName:  o.buyerRealName  || null,
              sellerRealName: o.sellerRealName || null,
              identityNo: null,
              chatDetectedAccount: null,
              paymentTermList: o.paymentMethod ? [{
                paymentType: o.paymentMethod,
                accountNo: null,
                realName: o.buyerRealName || null,
              }] : [],
            }
          }
        });
        
        try {
          const detailRes = await fetch(\`/api/binance/order/\${o.binanceOrderId || o.orderId}\`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            if (detail.ok && detail.result) {
              const dr = detail.result;
              setSelectedOrderDetails((prev: any) => ({
                ...prev,
                amountFiat: dr.totalPrice || amountFiat,
                counterparty: {
                  result: {
                    buyerRealName:  dr.buyerRealName || o.buyerRealName || null,
                    sellerRealName: dr.sellerRealName || null,
                    identityNo:     dr.identityNo || null,
                    chatDetectedAccount: dr.chatDetectedAccount || null,
                    chatDetectedCedula:  dr.chatDetectedCedula  || null,
                    accountHolder:       dr.accountHolder || dr.buyerRealName || null,
                    payId:               dr.payId || null,
                    paymentTermList: [{
                      paymentType: dr.paymentType || o.paymentMethod || 'Banco',
                      accountNo:   dr.chatDetectedAccount || dr.accountNo || null,
                      realName:    dr.accountHolder || dr.buyerRealName || o.buyerRealName || null,
                    }],
                  }
                }
              }));
            }
          }
        } catch(e2) {
          console.warn('[Binance detail]', e2);
        }
      }
    } catch(e) {
       console.error("Fallo obteniendo KYC/Banco", e);
       setSelectedOrderDetails({ ...o, counterparty: { result: null, error: 'Error de red' } });
    } finally {
       setLoadingDetails(false);
    }
  };

  `;

file = file.substring(0, startIndex) + newMethod + file.substring(endIndex);

fs.writeFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', file);
console.log('Update Complete 4');
