const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace success alerts
  content = content.replace(/alert\(\`Orden \$\{orderId\} asignada/g, 'console.log(`Orden ${orderId} asignada');
  content = content.replace(/alert\(\`Orden \$\{orderId\} liberada/g, 'console.log(`Orden ${orderId} liberada');
  content = content.replace(/alert\('✅ Orden marcada como Pagada/g, 'console.log(\'✅ Orden marcada como Pagada');
  content = content.replace(/alert\(\`✅/g, 'console.log(`✅');
  content = content.replace(/alert\('✅/g, 'console.log(\'✅');
  content = content.replace(/alert\('Orden marcada como Pagada en Bybit/g, 'console.log(\'Orden marcada como Pagada en Bybit');
  content = content.replace(/alert\('Se ha enviado el mensaje/g, 'console.log(\'Se ha enviado el mensaje');

  // Fetch chat
  const targetStr = `          const detailRes = await fetch(\`/api/binance/order/\${o.binanceOrderId || o.orderId}\`);\n          if (detailRes.ok) {`;
  
  const replacementStr = `          const [detailRes, chatRes] = await Promise.all([\n            fetch(\`/api/binance/order/\${o.binanceOrderId || o.orderId}\`),\n            fetch(\`/api/binance/order/\${o.binanceOrderId || o.orderId}/chat\`).catch(() => null)\n          ]);\n          let chatData: any = null;\n          if (chatRes && chatRes.ok) chatData = await chatRes.json();\n          if (detailRes.ok) {`;
  
  content = content.replace(targetStr, replacementStr);

  const assignStr = `                    chatDetectedAccount: dr.chatDetectedAccount || null,\n                    chatDetectedCedula:  dr.chatDetectedCedula  || null,`;
  const assignReplStr = `                    chatDetectedAccount: dr.chatDetectedAccount || chatData?.chatDetectedAccount || null,\n                    chatDetectedCedula:  dr.chatDetectedCedula  || chatData?.chatDetectedCedula || null,`;
  
  content = content.replace(assignStr, assignReplStr);
  
  fs.writeFileSync(file, content);
  console.log('Patched ' + file);
}

patchFile('apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx');
patchFile('apps/admin-dashboard/app/admin/p2p/page.tsx');
