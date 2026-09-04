import { NextResponse } from 'next/server';
import { readBinanceKeys, binanceSapi } from '../../../_lib/binance';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;
  const { apiKey, apiSecret } = readBinanceKeys();

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ ok: false, error: 'Falta Binance API Key o Secret.' });
  }

  try {
    const chatParams = { orderNo: orderId, page: 1, rows: 50, timestamp: Date.now() };
    const chatRes = await binanceSapi('GET', '/sapi/v1/c2c/chat/retrieveChatMessagesWithPagination', chatParams, apiKey, apiSecret);
    const messages = Array.isArray(chatRes) ? chatRes : (chatRes?.data ?? chatRes?.messages ?? []);
    
    // Sólo leemos los mensajes de texto
    const textMessages = messages.filter((m: any) => m.type === 'text');

    let chatDetectedAccount: string | null = null;
    let chatDetectedCedula:  string | null = null;
    let chatDetectedBank:    string | null = null;

    // Process newest to oldest (assuming textMessages comes in chronological order, we reverse it)
    for (const msg of [...textMessages].reverse()) {
      const text = msg.content || '';
      
      // Bank detection
      const lower = text.toLowerCase();
      if (!chatDetectedBank) {
        if (lower.includes('banesco') || text.includes('0134')) chatDetectedBank = 'Banesco';
        else if (lower.includes('mercantil') || text.includes('0105')) chatDetectedBank = 'Mercantil';
        else if (lower.includes('provincial') || text.includes('0108')) chatDetectedBank = 'Provincial';
        else if (lower.includes('venezuela') || lower.includes('bdv') || text.includes('0102')) chatDetectedBank = 'BdV';
        else if (lower.includes('bancamiga') || text.includes('0172')) chatDetectedBank = 'Bancamiga';
        else if (lower.includes('pago movil') || lower.includes('pagomovil')) chatDetectedBank = 'Pago Móvil';
        else if (text.includes('0156')) chatDetectedBank = '100% Banco';
        else if (text.includes('0114')) chatDetectedBank = 'Bancaribe';
        else if (text.includes('0115')) chatDetectedBank = 'Exterior';
        else if (text.includes('0151')) chatDetectedBank = 'BFC';
        else if (text.includes('0175')) chatDetectedBank = 'Bicentenario';
        else if (text.includes('0191')) chatDetectedBank = 'BNC';
        else if (text.includes('0138')) chatDetectedBank = 'Plaza';
        else if (text.includes('0104')) chatDetectedBank = 'Venezolano de Crédito';
      }

      // Account detection
      if (!chatDetectedAccount) {
        const m1 = text.match(/(?<![.\d])(0\d{19})(?![\d])/);
        if (m1) {
          chatDetectedAccount = m1[1];
        } else {
          const allMatches = [...text.matchAll(/0[\d][\d\-\s\.]{15,30}[\d]/g)];
          for (const m of allMatches) {
            const digits = m[0].replace(/[\s\-\.]/g, '');
            if (digits.length === 20 && /^0\d{3}/.test(digits)) {
              chatDetectedAccount = digits;
              break;
            }
          }
        }

        // Si no hay cuenta de 20 dígitos, buscamos número de Pago Movil (Ej: 0414 1234567 o 4141234567)
        if (!chatDetectedAccount) {
           const phoneMatches = text.match(/(?:0?)(414|412|416|424|426)[\s.-]?(\d{7})/);
           if (phoneMatches) {
             chatDetectedAccount = '0' + phoneMatches[1] + phoneMatches[2];
           }
        }
      }

      // Cedula detection
      if (!chatDetectedCedula) {
        const mPref = text.match(/[VvEeJjGg][-.\s]?([\d.]{6,11})/);
        if (mPref) {
          chatDetectedCedula = mPref[1].replace(/\./g, '');
        } else {
          const mRaw = text.match(/(?<![.\-\d])([\d.]{7,11})(?![\-\d])/);
          if (mRaw) {
            const candidate = mRaw[1].replace(/\./g, '');
            if (!chatDetectedAccount || !chatDetectedAccount.includes(candidate)) {
              chatDetectedCedula = candidate;
            }
          }
        }
      }

      // Si encuentra account y cedula en este mensaje de pura casualidad.
      // O si con los previos ya acumuló todo. 
    }

    return NextResponse.json({
      ok: true,
      chatDetectedAccount: chatDetectedAccount,
      chatDetectedCedula: chatDetectedCedula,
      chatDetectedBank: chatDetectedBank
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
