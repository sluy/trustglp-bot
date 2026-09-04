import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const DATA_DIR  = '/app/data';
const KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');

function readKeys(): Record<string, string> {
  try { if (!existsSync(KEYS_FILE)) return {}; return JSON.parse(readFileSync(KEYS_FILE, 'utf-8')); } catch { return {}; }
}
function isMasked(s: string | undefined): boolean { return !s || s.includes('·') || s === '***' || s.length < 8; }

function makeBybitHeaders(apiKey: string, apiSecret: string, bodyStr: string) {
  const timestamp = Date.now().toString();
  const recvWindow = '5000';
  const sign = crypto.createHmac('sha256', apiSecret).update(timestamp + apiKey + recvWindow + bodyStr).digest('hex');
  return { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-SIGN': sign, 'X-BAPI-SIGN-TYPE': '2', 'X-BAPI-TIMESTAMP': timestamp, 'X-BAPI-RECV-WINDOW': recvWindow, 'Content-Type': 'application/json' };
}

async function bybitPost(apiKey: string, apiSecret: string, endpoint: string, bodyObj: any) {
  const bodyStr = JSON.stringify(bodyObj);
  const res = await fetch(`https://api.bybit.com${endpoint}`, { method: 'POST', headers: makeBybitHeaders(apiKey, apiSecret, bodyStr), body: bodyStr, cache: 'no-store' });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`no-JSON [${res.status}]: ${text.slice(0, 150)}`); }
}

async function getPaymentId(apiKey: string, apiSecret: string, orderId: string) {
  try {
    const info = await bybitPost(apiKey, apiSecret, '/v5/p2p/order/info', { orderId });
    if ((info.retCode ?? info.ret_code) === 0 && info.result?.paymentTermList?.length > 0) {
      const t = info.result.paymentTermList[0];
      return { paymentId: String(t.paymentId ?? t.id ?? ''), paymentType: t.paymentType ? String(t.paymentType) : undefined };
    }
  } catch (_) {}
  return {};
}

async function trySendChat(apiKey: string, apiSecret: string, orderId: string, message: string): Promise<{ ok: boolean; note: string }> {
  try {
    const r = await bybitPost(apiKey, apiSecret, '/v5/p2p/order/message/send', { orderId, message, contentType: 'str', msgUuid: crypto.randomUUID() });
    const code = r.retCode ?? r.ret_code;
    return code === 0 ? { ok: true, note: '' } : { ok: false, note: `Chat: ${r.retMsg ?? r.ret_msg}` };
  } catch (e: any) { return { ok: false, note: `Chat error: ${e.message?.slice(0, 60)}` }; }
}

async function tryMarkPaid(apiKey: string, apiSecret: string, orderId: string): Promise<{ ok: boolean; note: string }> {
  try {
    const { paymentId, paymentType } = await getPaymentId(apiKey, apiSecret, orderId);
    const payload: any = { orderId };
    if (paymentId) { payload.paymentId = paymentId; payload.paymentType = paymentType; }
    const r = await bybitPost(apiKey, apiSecret, '/v5/p2p/order/pay', payload);
    const code = r.retCode ?? r.ret_code;
    return code === 0 ? { ok: true, note: '' } : { ok: false, note: `Pago: ${r.retMsg ?? r.ret_msg} (${code})` };
  } catch (e: any) { return { ok: false, note: `Pago error: ${e.message?.slice(0, 60)}` }; }
}

export async function POST(req: Request, { params }: { params: { orderId: string } }) {
  const { orderId } = params;
  const keys = readKeys();
  const apiKey    = (keys.bybitApiKey    && !isMasked(keys.bybitApiKey))    ? keys.bybitApiKey    : (process.env.BYBIT_API_KEY    || '');
  const apiSecret = (keys.bybitApiSecret && !isMasked(keys.bybitApiSecret)) ? keys.bybitApiSecret : (process.env.BYBIT_API_SECRET || '');
  if (!apiKey || !apiSecret) return NextResponse.json({ ok: false, error: 'API keys no configuradas' });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body inválido' }); }
  const { action, message } = body;

  // ── ENVIAR MENSAJE ──────────────────────────────────────────────────────────
  if (action === 'send_message') {
    if (!message?.trim()) return NextResponse.json({ ok: false, error: 'Mensaje vacío' });
    const r = await trySendChat(apiKey, apiSecret, orderId, message.trim());
    return NextResponse.json(r.ok ? { ok: true } : { ok: false, error: r.note });
  }

  // ── SOLICITAR DATOS (AUTOMATIZADO) ──────────────────────────────────────────
  if (action === 'request_ci') {
    const textContent = "Por favor, indíquenos sus datos bancarios por este chat para proceder con el pago.";
    const r = await trySendChat(apiKey, apiSecret, orderId, textContent);
    return NextResponse.json(r.ok ? { ok: true } : { ok: false, error: r.note });
  }

  // ── ENVIAR COMPROBANTE AL CHAT + MARCAR PAGADO (ambos no-bloqueantes) ──────
  if (action === 'pay_with_receipt') {
    const receiptUrl = body.receiptUrl as string | undefined;
    if (!receiptUrl) return NextResponse.json({ ok: false, error: 'Falta receiptUrl.' });

    const safeUrl = receiptUrl || '';
    const chatMessage = safeUrl
      ? `Transferencia realizada ✅. Para ver tu COMPROBANTE de pago valido por 24h: ${safeUrl} — Por favor verifica tu banco y libera los fondos. Gracias.`
      : `Transferencia realizada ✅. Por favor verifica tu banco y libera los fondos. Gracias.`;
    const chatResult = await trySendChat(apiKey, apiSecret, orderId, chatMessage);
    await new Promise(r => setTimeout(r, 500));
    const payResult  = await tryMarkPaid(apiKey, apiSecret, orderId);

    const notes = [chatResult.note, payResult.note].filter(Boolean).join(' | ');

    // Si marcamos como pagado con éxito → recordatorio automático a los 10 minutos
    if (payResult.ok) {
      setTimeout(async () => {
        await trySendChat(apiKey, apiSecret, orderId,
          'Recuerde verificar su banco y confirmar el pago recibido para liberar los fondos. ¡Gracias por operar con nosotros! 🙏'
        );
      }, 600000); // 10 minutos
    }

    return NextResponse.json({ ok: true, receiptUrl, chatOk: chatResult.ok, paidOk: payResult.ok, notes });
  }

  // ── MARCAR PAGADO (sin imagen) ──────────────────────────────────────────────
  if (action === 'mark_paid') {
    const r = await tryMarkPaid(apiKey, apiSecret, orderId);
    if (r.ok) {
      // Enviar mensaje de recordatorio automático (no bloquea)
      setTimeout(async () => {
        await trySendChat(apiKey, apiSecret, orderId,
          'Recuerde verificar su banco y confirmar el pago recibido para liberar los fondos. ¡Gracias por operar con nosotros! 🙏'
        );
      }, 600000); // 10 minutos
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: r.note });
  }

  return NextResponse.json({ ok: false, error: `Acción desconocida: ${action}` });
}
