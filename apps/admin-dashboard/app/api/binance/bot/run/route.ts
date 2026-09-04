import { NextResponse } from 'next/server';
import { readBinanceKeys, binanceSapi, sendSapiChatMessage } from '../../_lib/binance';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { apiKey, apiSecret } = readBinanceKeys();
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ ok: false, error: 'No keys' });
  }

  const results: any[] = [];

  try {
    // Buscar órdenes recientes (últimos 3 días por ejemplo para no saturar)
    // El sistema devuelve las últimas órdenes por defecto.
    const ts = Date.now();
    let allHistory: any[] = [];
    
    for (const tradeType of ['BUY', 'SELL']) {
      try {
        const history = await binanceSapi('GET', '/sapi/v1/c2c/orderMatch/listUserOrderHistory', {
          timestamp: ts,
          tradeType
        }, apiKey, apiSecret);
        if (history && Array.isArray(history)) {
          allHistory = allHistory.concat(history);
        }
      } catch (e) {}
    }

    if (allHistory.length === 0) {
      return NextResponse.json({ ok: true, message: 'No orders found', results });
    }

    const activeOrders = allHistory.filter((o: any) => 
      ['PENDING', 'TRADING', 'BUYER_PAYED', 'DISTRIBUTING', 'IN_APPEAL'].includes(o.orderStatus)
    );

    for (const order of activeOrders) {
      const orderNo = order.orderNumber;
      
      // Obtener chat
      const chatParams = { orderNo, page: 1, rows: 50, timestamp: Date.now() };
      const chat = await binanceSapi('GET', '/sapi/v1/c2c/chat/retrieveChatMessagesWithPagination', chatParams, apiKey, apiSecret);
      
      const messages = Array.isArray(chat) ? chat : [];
      const textMessages = messages.filter((m: any) => m.type === 'text');
      const allText = textMessages.map((m: any) => m.content).join(' ');

      // 1. Mensaje de Bienvenida (Si no se ha enviado y es una compra nuestra)
      if (order.tradeType === 'BUY' && !allText.includes('automatizado')) {
        const welcomeText = "Bienvenido, este proceso está apoyado por nuestro sistema automatizado.";
        await sendSapiChatMessage(orderNo, welcomeText, 'text', apiKey, apiSecret);
        results.push({ orderNo, action: 'WELCOME_SENT' });
        continue; // Pausa para no bombardear
      }

      // 2. Recordatorio 15 min (Si está pagado y pasaron 15 mins)
      if (order.orderStatus === 'BUYER_PAYED') {
        // En listUserOrderHistory no siempre viene payTime, pero podemos deducirlo o 
        // usar el createTime si no hay otra, o mejor pedir getUserOrderDetail.
        // Pero para no hacer demasiados requests, pediremos detalles de orden.
        
        const detailsParams = { adOrderNo: orderNo, timestamp: Date.now() };
        let payTime = 0;
        try {
           const details = await binanceSapi('POST', '/sapi/v1/c2c/orderMatch/getUserOrderDetail', detailsParams, apiKey, apiSecret);
           // Binance API uses notifyPayTime for when the buyer marks the order as paid
           payTime = details?.notifyPayTime || details?.result?.notifyPayTime || details?.payTime || details?.result?.payTime || order.createTime || 0;
        } catch(e) {}

        if (payTime > 0) {
          const minsSincePay = (Date.now() - payTime) / (1000 * 60);
          if (minsSincePay >= 15 && !allText.includes('15 minutos')) {
            const reminderText = "Hola, han pasado 15 minutos desde que realizamos el pago. Por favor, recuerda confirmar y liberar los criptoactivos.";
            await sendSapiChatMessage(orderNo, reminderText, 'text', apiKey, apiSecret);
            results.push({ orderNo, action: 'REMINDER_SENT' });
          }
        }
      }
    }

    return NextResponse.json({ ok: true, results });

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
