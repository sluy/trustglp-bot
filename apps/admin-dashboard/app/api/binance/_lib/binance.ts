/**
 * Helper compartido para todas las rutas de Binance P2P API
 * Basado en el código de muestra oficial de Binance (Case #161563442)
 * PATRÓN OFICIAL: params en query string, solo X-MBX-APIKEY header, POST con body vacío
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR  = '/app/data';
const KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');

export function readBinanceKeys(): { apiKey: string; apiSecret: string } {
  let keys: Record<string, string> = {};
  try {
    if (existsSync(KEYS_FILE)) {
      keys = JSON.parse(readFileSync(KEYS_FILE, 'utf-8'));
    }
  } catch {}
  const isMasked = (s?: string) => !s || s.includes('·') || s === '***' || s.length < 8;
  const apiKey    = (keys.binanceApiKey    && !isMasked(keys.binanceApiKey))    ? keys.binanceApiKey    : (process.env.BINANCE_API_KEY    || '');
  const apiSecret = (keys.binanceApiSecret && !isMasked(keys.binanceApiSecret)) ? keys.binanceApiSecret : (process.env.BINANCE_API_SECRET || '');
  return { apiKey, apiSecret };
}

/** Lee las cookies de sesión de Binance (para BAPI) */
export function readBinanceCookies(): string {
  try {
    if (existsSync(KEYS_FILE)) {
      const keys = JSON.parse(readFileSync(KEYS_FILE, 'utf-8'));
      if (keys.binanceCookies && keys.binanceCookies.length > 10) return keys.binanceCookies;
    }
  } catch {}
  return process.env.BINANCE_COOKIES || '';
}

export function signBinance(apiSecret: string, queryString: string): string {
  return crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

/**
 * BAPI: petición a la API interna de Binance (www.binance.com/bapi/c2c/...)
 * 
 * ⚠️  CRÍTICO: BAPI NO usa firma HMAC ni timestamp.
 * El navegador envía SOLO cookies de sesión + JSON body.
 * SAPI = API Key + Firma HMAC  (para operaciones de cuenta)
 * BAPI = Cookies de sesión + JSON body (para operaciones del navegador web)
 */
export async function binanceBapi(
  method: 'GET' | 'POST',
  bapiPath: string,
  params: Record<string, string | number>,
  _apiKey: string,
  _apiSecret: string,
  cookies: string,
  extraBody?: Record<string, unknown>,
): Promise<any> {
  // BAPI: Usar el gateway c2c oficial de Binance
  const url = `https://c2c.binance.com${bapiPath}`;

  // Extraer valores clave de las cookies
  const csrf = cookies.split(';').find(c => c.trim().startsWith('csrftoken='))?.split('=')[1]?.trim() || '';
  const bncUuid = cookies.split(';').find(c => c.trim().startsWith('bnc-uuid='))?.split('=')[1]?.trim() || '';

  // Headers idénticos a Chrome en c2c.binance.com
  const headers: Record<string, string> = {
    'Cookie':             cookies,
    'Content-Type':       'application/json',
    'User-Agent':         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':             '*/*',
    'Accept-Language':    'es-419,es;q=0.9',
    'Origin':             'https://c2c.binance.com',
    'Referer':            'https://c2c.binance.com/',
    'clientType':         'web',
    'C2ctype':            'c2c_web',
    'Bnc-Level':          '0',
    'Bnc-Location':       'VE',
    'Bnc-Time-Zone':      'America/Caracas',
    'lang':               'es',
  };

  if (csrf) headers['Csrftoken'] = csrf;
  if (bncUuid) headers['Bnc-Uuid'] = bncUuid;

  // Body JSON con los params de la operación
  const bodyObj = { ...params, ...extraBody };
  const body    = method === 'POST' ? JSON.stringify(bodyObj) : undefined;

  const res  = await fetch(url, { method, headers, body, cache: 'no-store' });
  const text = await res.text();

  let json: any;
  try { json = JSON.parse(text); }
  catch { throw new Error(`Binance BAPI non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}`); }

  if (json.code && json.code !== '000000' && json.success !== true) {
    throw new Error(`Binance BAPI ${json.code}: ${json.message || json.msg || 'error'}`);
  }
  return json.data ?? json;
}


/**
 * Petición firmada a la API de Binance SAPI
 * - GET:  todos los params en query string
 * - POST: todos los params en body form-urlencoded
 * - clientType: web es OBLIGATORIO para endpoints C2C merchant
 */
export async function binanceSapi(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  apiPath: string,
  params: Record<string, string | number>,
  apiKey: string,
  apiSecret: string,
): Promise<any> {
  const timestamp = Date.now().toString();
  const baseUrl   = `https://api.binance.com${apiPath}`;

  // ✅ OFICIAL BINANCE (Case #161563442): solo X-MBX-APIKEY header, sin Content-Type
  // Pero manual indica que clientType es OBLIGATORIO.
  const headers: Record<string, string> = {
    'X-MBX-APIKEY': apiKey,
    'clientType': 'web',
  };

  const allParams = { ...params, timestamp };

  // Patrón idéntico al Python oficial de Binance:
  // query_string = urlencode(payload)
  // query_string = f"{query_string}&timestamp={get_timestamp()}"
  // signature = hashing(query_string)  ← HMAC sobre el string plano
  // url = f"{BASE_URL}{url_path}?{query_string}&signature={signature}"
  const paramStr  = Object.entries(allParams)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('&');
  const signature = signBinance(apiSecret, paramStr);

  const payloadStr = `${paramStr}&signature=${signature}`;
  let url = baseUrl;
  let body: string | undefined = undefined;

  if (method === 'GET' || method === 'DELETE') {
    url = `${baseUrl}?${payloadStr}`;
  } else {
    // HACK: Binance WAF rejects JSON with signature inside it for C2C API (-1002).
    // The solution is to pass the signature in the query string, but the params in the JSON body.
    url = `${baseUrl}?${payloadStr}`;
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(params);
  }

  const res  = await fetch(url, { method, headers, body, cache: 'no-store' });
  const text = await res.text();

  let json: any;
  try { json = JSON.parse(text); }
  catch { throw new Error(`Binance non-JSON: ${text.slice(0, 300)}`); }

  if (json.code && json.code !== '000000' && json.code !== 0) {
    throw new Error(`Binance ${json.code}: ${json.message || json.msg || 'unknown error'}`);
  }

  return json.data ?? json;
}

/**
 * Extrae cuenta bancaria, cédula y nombre del titular de un texto libre
 */
export function parseAccountAndCedula(text: string): {
  account: string | null;
  cedula:  string | null;
  name:    string | null;
} {
  const cleanNum = text.replace(/\s+/g, '');
  const accountMatch = cleanNum.match(/(0[12]\d{18})/) || cleanNum.match(/(\d{20})/);
  const account = accountMatch ? accountMatch[1] : null;

  const remaining = account ? cleanNum.replace(account, '') : cleanNum;
  const cedulaMatch = remaining.match(/\b(\d{6,9})\b/) || remaining.match(/(\d{6,9})/);
  const cedula = cedulaMatch ? cedulaMatch[1] : null;

  const nameMatch = text.match(/\b([A-ZÁÉÍÓÚÑ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ]{3,}){1,4})\b/);
  const name = nameMatch ? nameMatch[1].trim() : null;

  return { account, cedula, name };
}

/**
 * Función centralizada para enviar mensajes al chat P2P usando WebSockets (SAPI)
 * Soluciona la ausencia de un endpoint REST público para enviar mensajes y las
 * restricciones de BAPI (cookies).
 */
export async function sendSapiChatMessage(
  orderNo: string,
  content: string, // Para texto es el mensaje, para imagen es la URL pública
  type: 'text' | 'image',
  apiKey: string,
  apiSecret: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ts = Date.now().toString();
    const paramStr = `timestamp=${ts}`;
    const sig = signBinance(apiSecret, paramStr);

    const credsRes = await fetch(`https://api.binance.com/sapi/v1/c2c/chat/retrieveChatCredential?${paramStr}&signature=${sig}`, {
      headers: { 'X-MBX-APIKEY': apiKey, 'clientType': 'web' }
    });
    
    if (!credsRes.ok) {
      return { ok: false, error: 'Fallo al obtener credenciales de chat SAPI' };
    }
    
    const creds = await credsRes.json();
    if (!creds?.data?.chatWssUrl) {
      return { ok: false, error: 'Credenciales inválidas o incompletas de SAPI' };
    }

    const wssUrl = `${creds.data.chatWssUrl}/${creds.data.listenKey}?token=${creds.data.listenToken}&clientType=web`;

    return new Promise((resolve) => {
      try {
        // @ts-ignore - En Node 20+, WebSocket es global
        const ws = new WebSocket(wssUrl);
        
        ws.onopen = () => {
          const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
          
          let msg: any = {
            type: type,
            uuid: uuid,
            orderNo: orderNo,
            self: true,
            clientType: 'web',
            createTime: Date.now(),
            sendStatus: 0
          };

          if (type === 'image') {
            msg.imageUrl = content;
            msg.thumbnailUrl = content;
            msg.imageType = 'jpeg';
            msg.width = 500;
            msg.height = 500;
          } else {
            msg.content = content;
          }

          ws.send(JSON.stringify(msg));
          setTimeout(() => { ws.close(); resolve({ ok: true }); }, 1500);
        };
        
        ws.onerror = (e: any) => resolve({ ok: false, error: e.message || 'WS Error' });
      } catch (e: any) {
        resolve({ ok: false, error: e.message });
      }
    });
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
