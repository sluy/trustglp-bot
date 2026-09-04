import { NextResponse } from 'next/server';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

// Los recibos se guardan en el directorio temporal del OS
const RECEIPTS_DIR = path.join(os.tmpdir(), 'p2p-receipts');

function expiredHtml() {
  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comprobante Expirado</title>
<style>
  body { background: #0f172a; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; gap: 16px; padding: 20px; }
  h1 { color: #ef4444; font-size: 24px; }
  p { max-width: 400px; text-align: center; line-height: 1.6; }
</style>
</head>
<body>
  <h1>⚠️ Comprobante Expirado</h1>
  <p>Este enlace de validación ha expirado o no existe.<br>Los comprobantes son válidos solo por <strong>24 horas</strong>.</p>
</body></html>`;
}

function receiptHtml(imgSrc: string, code: string, remH: number, remM: number) {
  const timeStr = remH > 0 ? `${remH}H ${remM}MIN` : `${remM}MIN`;
  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comprobante de Pago #${code}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 24px 16px;
  }
  .banner {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.08em;
    padding: 10px 24px;
    border-radius: 999px;
    margin-bottom: 20px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(16,185,129,0.5);
    text-transform: uppercase;
  }
  .card {
    background: #1e293b;
    border-radius: 20px;
    padding: 16px;
    max-width: 420px;
    width: 100%;
    border: 1px solid #334155;
    box-shadow: 0 25px 60px rgba(0,0,0,0.6);
  }
  .receipt-img {
    width: 100%;
    border-radius: 12px;
    display: block;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  }
  .footer {
    margin-top: 16px;
    text-align: center;
    color: #64748b;
    font-size: 12px;
    border-top: 1px solid #334155;
    padding-top: 12px;
  }
  .code {
    color: #22d3ee;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.15em;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .timer {
    color: #f59e0b;
    font-size: 11px;
    margin-top: 2px;
  }
  .verified {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #10b981;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 8px;
  }
</style>
</head>
<body>
  <div class="banner">✅ VALIDACIÓN SEGURA (EXPIRA EN ${timeStr})</div>
  <div class="card">
    <div class="verified">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      Comprobante verificado por la plataforma
    </div>
    <img src="${imgSrc}" alt="Comprobante de pago" class="receipt-img"/>
    <div class="footer">
      <div class="code">Comprobante #${code}</div>
      <div class="timer">⏱ Este enlace expirará en ${timeStr.toLowerCase()}</div>
    </div>
  </div>
</body></html>`;
}

export async function GET(
  req: Request,
  { params }: { params: { code: string } }
) {
  const { code } = params;

  // Validar formato del código (solo alfanumérico y base64url)
  if (!code || !/^[a-zA-Z0-9_-]{4,20}$/.test(code)) {
    return new Response(expiredHtml(), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const metaPath = path.join(RECEIPTS_DIR, `${code}.meta.json`);

  if (!existsSync(metaPath)) {
    return new Response(expiredHtml(), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  let meta: any;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  } catch {
    return new Response(expiredHtml(), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // Verificar expiración
  if (Date.now() > meta.expiresAt) {
    // Limpiar archivos expirados
    try { unlinkSync(metaPath); } catch (_) {}
    try { unlinkSync(path.join(RECEIPTS_DIR, `${code}.${meta.ext}`)); } catch (_) {}
    return new Response(expiredHtml(), { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const imgPath = path.join(RECEIPTS_DIR, `${code}.${meta.ext}`);
  if (!existsSync(imgPath)) {
    return new Response(expiredHtml(), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const imgData = readFileSync(imgPath);
  const base64Img = `data:image/${meta.ext};base64,${imgData.toString('base64')}`;

  const remainingMs = Math.max(0, meta.expiresAt - Date.now());
  const remH = Math.floor(remainingMs / 3600000);
  const remM = Math.floor((remainingMs % 3600000) / 60000);

  return new Response(receiptHtml(base64Img, code.toUpperCase(), remH, remM), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
