const fs = require('fs');
const file = 'c:/Users/sebas/Desktop/agenteInteligente/quant-global/apps/admin-dashboard/app/portal/operador/components/OperadorP2pView.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const P2P_API = process\.env\.NEXT_PUBLIC_P2P_API_URL[\s\S]*?fetchOrders\(\);\s*\}\s*else\s*\{\s*const errData[\s\S]*?alert\(`Hubo un error contactando a la API de Bybit:\\n\\n\$\{serverMsg\}`\);\s*\}/;

const replacementStr = `// ── FLUJO BYBIT ──────────────────────────────────────────────────────────
            // 1. Subir imagen y obtener URL corta segura
            const uploadRes = await fetch(\`/api/bybit/receipt/upload\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: receiptImageBase64 }),
            });
            const uploadData = await uploadRes.json();

            if (!uploadData.ok) {
              alert(\`❌ Error guardando imagen Bybit: \${uploadData.error}\`);
              return;
            }

            // 2. Enviar URL al chat de Bybit y marcar pagado
            const paidRes = await fetch(\`/api/bybit/order/\${orderId}/chat\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'pay_with_receipt', receiptUrl: uploadData.url }),
            });
            const paidData = await paidRes.json();

            const lines = ['✅ Bybit - Proceso ejecutado:'];
            lines.push(uploadData.ok ? '📎 Comprobante guardado y enviado al chat' : '⚠️ Imagen no guardada');
            lines.push(paidData.ok ? '✅ Orden marcada como Pagada' : \`⚠️ Pago: \${paidData.error || 'no confirmado'}\`);
            alert(lines.join('\\n'));

            if (paidData.ok) {
                if (order) await updateOperatorStats(order);
            }
            
            setReceiptImageBase64(null);
            setSelectedOrderDetails(null);
            setAssignedOrders(prev => prev.filter((o: any) => (o.bybitOrderId || o.binanceOrderId) !== orderId));
            fetchOrders();`;

if (regex.test(content)) {
  content = content.replace(regex, replacementStr);
  fs.writeFileSync(file, content);
  console.log('Replaced correctly');
} else {
  console.log('Regex not found');
}
