const fs = require('fs');

let opFile = fs.readFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', 'utf8');

// The modal from temp_modal_clean.tsx
let modalFile = fs.readFileSync('temp_modal_clean.tsx', 'utf8');

// Strip remaining isFrankTheme and isRafaTheme from modalFile
modalFile = modalFile.replace(/\{isFrankTheme \? "[^"]*" : isRafaTheme \? "[^"]*" : "([^"]*)"\}/g, '"$1"');
modalFile = modalFile.replace(/\{isFrankTheme \? '[^']*' : isRafaTheme \? '[^']*' : '([^']*)'\}/g, '"$1"');
modalFile = modalFile.replace(/\{isFrankTheme \? `[^`]*` : isRafaTheme \? `[^`]*` : `([^`]*)`\}/g, '"$1"');
modalFile = modalFile.replace(/className=\{isFrankTheme \? [^:]* : [^:]* : "([^"]*)"\}/g, 'className="$1"');
modalFile = modalFile.replace(/className=\{isFrankTheme \? [^:]* : [^:]* : '([^']*)'\}/g, 'className="$1"');
modalFile = modalFile.replace(/className=\{isFrankTheme \? "[^"]*" : "([^"]*)"\}/g, 'className="$1"');
modalFile = modalFile.replace(/className=\{isFrankTheme \? '[^']*' : '([^']*)'\}/g, 'className="$1"');
modalFile = modalFile.replace(/\{isFrankTheme \? .*?\}/g, '""');

// Fix references
modalFile = modalFile.replace(/selectedOrderDetails\.counterparty\?/g, 'selectedOrderDetails.counterparty?');
modalFile = modalFile.replace(/selectedOrderDetails\.bybitOrderId/g, '(selectedOrderDetails.bybitOrderId || selectedOrderDetails.orderId)');

// Extract JUST the modal from temp_modal_clean.tsx
// It starts with `{selectedOrderDetails && (`
// We want everything up to `      )}\n    </div>` but NOT including `</div>` or `); }`
const pureModalMatch = modalFile.match(/\{selectedOrderDetails && \([\s\S]*?\n\s*\)\}/);
if (!pureModalMatch) {
    console.error("No se pudo extraer modal purificado");
    process.exit(1);
}
const pureModal = pureModalMatch[0];


// Inject refreshChatData
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

const injectionPoint = opFile.indexOf('const handleRequestCI');
opFile = opFile.slice(0, injectionPoint) + chatCodeToInject + opFile.slice(injectionPoint);

if (!opFile.includes('useCallback')) {
    opFile = opFile.replace('import React, { useState, useEffect }', 'import React, { useState, useEffect, useCallback, useRef }');
} else if (!opFile.includes('useRef')) {
    opFile = opFile.replace('import React, { useState, useEffect, useCallback }', 'import React, { useState, useEffect, useCallback, useRef }');
}

// Extract old modal from OperadorP2pView.tsx
const oldModalMatch = opFile.match(/\{selectedOrderDetails && \([\s\S]*?\n\s*\)\}/);
if (!oldModalMatch) {
    console.error("Old modal no encontrado en OperadorP2pView.tsx");
    process.exit(1);
}

// Replace
opFile = opFile.replace(oldModalMatch[0], pureModal);

fs.writeFileSync('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx', opFile);
console.log('Successfully replaced modal');
