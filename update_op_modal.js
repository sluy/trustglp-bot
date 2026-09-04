const fs = require('fs');

let opFile = fs.readFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', 'utf8');
let modalFile = fs.readFileSync('temp_modal_clean.tsx', 'utf8');

// Strip remaining isFrankTheme and isRafaTheme from modalFile
modalFile = modalFile.replace(/\{isFrankTheme \? "[^"]*" : isRafaTheme \? "[^"]*" : "([^"]*)"\}/g, '"$1"');
modalFile = modalFile.replace(/\{isFrankTheme \? '[^']*' : isRafaTheme \? '[^']*' : '([^']*)'\}/g, '"$1"');
modalFile = modalFile.replace(/\{isFrankTheme \? `[^`]*` : isRafaTheme \? `[^`]*` : `([^`]*)`\}/g, '"$1"');
modalFile = modalFile.replace(/className=\{isFrankTheme \? [^:]* : [^:]* : "([^"]*)"\}/g, 'className="$1"');
modalFile = modalFile.replace(/className=\{isFrankTheme \? [^:]* : [^:]* : '([^']*)'\}/g, 'className="$1"');

// Replace conditional logic like: className={isFrankTheme ? "A" : "B"}
modalFile = modalFile.replace(/className=\{isFrankTheme \? "[^"]*" : "([^"]*)"\}/g, 'className="$1"');
modalFile = modalFile.replace(/className=\{isFrankTheme \? '[^']*' : '([^']*)'\}/g, 'className="$1"');

// Fix selectedOrderDetails.counterparty?.result
modalFile = modalFile.replace(/selectedOrderDetails\.counterparty\?/g, 'selectedOrderDetails.counterparty?');

// Handle selectedOrderDetails.bybitOrderId vs orderId
modalFile = modalFile.replace(/selectedOrderDetails\.bybitOrderId/g, '(selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId)');


// 1. Inject refreshChatData and chatPollRef
const injectionPoint = opFile.indexOf('const handleRequestCI');

const chatCodeToInject = `
  const chatPollRef = useRef<NodeJS.Timeout | null>(null);

  const refreshChatData = useCallback(async (orderId: string, exchangeType: string) => {
    try {
      if (exchangeType === 'binance') {
        const orderRes = await fetch(\`/api/binance/order/\${orderId}\`, { cache: 'no-store' });
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          if (orderData.ok && (orderData.result?.chatDetectedAccount || orderData.result?.chatDetectedCedula)) {
            setSelectedOrderDetails((prev: any) => {
              if (!prev || (prev.bybitOrderId !== orderId && prev.orderId !== orderId)) return prev;
              return {
                ...prev,
                counterparty: {
                  ...prev.counterparty,
                  result: {
                    ...prev.counterparty?.result,
                    chatDetectedAccount: orderData.result.chatDetectedAccount || prev.counterparty?.result?.chatDetectedAccount,
                    chatDetectedCedula:  orderData.result.chatDetectedCedula  || prev.counterparty?.result?.chatDetectedCedula,
                    accountHolder:       orderData.result.accountHolder        || prev.counterparty?.result?.accountHolder,
                    payId:               orderData.result.payId                || prev.counterparty?.result?.payId,
                  }
                }
              };
            });
          }
        }

        const chatRes = await fetch(\`/api/binance/order/\${orderId}/chat\`, { cache: 'no-store' });
        if (!chatRes.ok) return;
        const chatData = await chatRes.json();
        if (chatData.chatDetectedAccount || chatData.chatDetectedCedula) {
          setSelectedOrderDetails((prev: any) => {
            if (!prev || (prev.bybitOrderId !== orderId && prev.orderId !== orderId)) return prev;
            return {
              ...prev,
              counterparty: {
                ...prev.counterparty,
                result: {
                  ...prev.counterparty?.result,
                  chatOnlyAccount: chatData.chatDetectedAccount,
                  chatOnlyCedula:  chatData.chatDetectedCedula,
                  chatOnlyBank:    chatData.chatDetectedBank,
                }
              }
            };
          });
        }
      } else {
        const res = await fetch(\`/api/bybit/order/\${orderId}\`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setSelectedOrderDetails((prev: any) => {
          if (!prev || (prev.bybitOrderId !== orderId && prev.orderId !== orderId)) return prev;
          return { ...prev, counterparty: data };
        });
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    if (selectedOrderDetails?.orderId || selectedOrderDetails?.bybitOrderId) {
      const id = selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId;
      const ex = selectedOrderDetails.exchange || 'bybit';
      const interval = ex === 'binance' ? 5000 : 10000;
      refreshChatData(id, ex);
      chatPollRef.current = setInterval(() => refreshChatData(id, ex), interval);
    }
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [selectedOrderDetails?.orderId, selectedOrderDetails?.bybitOrderId, refreshChatData]);

`;

opFile = opFile.slice(0, injectionPoint) + chatCodeToInject + opFile.slice(injectionPoint);

if (!opFile.includes('useCallback')) {
    opFile = opFile.replace('import React, { useState, useEffect }', 'import React, { useState, useEffect, useCallback, useRef }');
} else if (!opFile.includes('useRef')) {
    opFile = opFile.replace('import React, { useState, useEffect, useCallback }', 'import React, { useState, useEffect, useCallback, useRef }');
}

// 2. Replace the old modal block
const modalStartIdx = opFile.indexOf('{selectedOrderDetails && (');
const modalEndIdx = opFile.lastIndexOf(')}');

// opFile is updated
opFile = opFile.substring(0, modalStartIdx) + modalFile + '\n' + opFile.substring(modalEndIdx + 2);

fs.writeFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', opFile);
console.log('Successfully injected.');
