import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// Forzar modo dinámico - evita caché de Next.js
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DATA_DIR  = '/app/data';
const DATA_FILE = path.join(DATA_DIR, 'api_keys.json');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}
function readKeys(): Record<string, string> {
  try { ensureDir(); if (!existsSync(DATA_FILE)) return {}; return JSON.parse(readFileSync(DATA_FILE, 'utf-8')); }
  catch { return {}; }
}
function writeKeys(k: Record<string, string>) {
  ensureDir(); writeFileSync(DATA_FILE, JSON.stringify(k, null, 2), 'utf-8');
}
function mask(s: string | undefined): string {
  if (!s || s.length < 8) return s ? '***' : '';
  return s.slice(0, 4) + '·'.repeat(Math.max(s.length - 8, 4)) + s.slice(-4);
}
function isMasked(s: string | undefined): boolean {
  return !s || s.includes('·') || s === '***' || s.length < 8;
}

// GET — devuelve claves enmascaradas
export async function GET() {
  const k = readKeys();
  return NextResponse.json({
    binanceKey:    mask(k.binanceApiKey),
    bybitKey:      mask(k.bybitApiKey),
    telegramToken: mask(k.telegramBotToken),
    telegramChatId: k.telegramChatId || '',
    hasBinance:       !!k.binanceApiKey    && !isMasked(k.binanceApiKey),
    hasBinanceSecret: !!k.binanceApiSecret && !isMasked(k.binanceApiSecret),
    hasBybit:         !!k.bybitApiKey      && !isMasked(k.bybitApiKey),
    hasBybitSecret:   !!k.bybitApiSecret   && !isMasked(k.bybitApiSecret),
    hasTelegram:      !!k.telegramBotToken && !isMasked(k.telegramBotToken),
    hasBinanceCookies: !!k.binanceCookies  && k.binanceCookies.length > 10,
    binanceCookiesLen: k.binanceCookies ? k.binanceCookies.length : 0,
  });
}

// POST — guarda claves (solo sobrescribe campos no vacíos y no enmascarados)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const current = readKeys();
    const updated = { ...current };
    // Solo guardar si el valor existe, no está vacío y no es un valor enmascarado
    if (body.binanceApiKey    && !isMasked(body.binanceApiKey))    updated.binanceApiKey    = body.binanceApiKey;
    if (body.binanceApiSecret && !isMasked(body.binanceApiSecret)) updated.binanceApiSecret = body.binanceApiSecret;
    if (body.binanceCookies   && body.binanceCookies.length > 10)  updated.binanceCookies   = body.binanceCookies;
    if (body.bybitApiKey      && !isMasked(body.bybitApiKey))      updated.bybitApiKey      = body.bybitApiKey;
    if (body.bybitApiSecret   && !isMasked(body.bybitApiSecret))   updated.bybitApiSecret   = body.bybitApiSecret;
    if (body.telegramBotToken && !isMasked(body.telegramBotToken)) updated.telegramBotToken = body.telegramBotToken;
    if (body.telegramChatId !== undefined && body.telegramChatId !== '') updated.telegramChatId = body.telegramChatId;
    writeKeys(updated);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — limpia todas las claves (reset completo para re-ingresar las reales)
export async function DELETE() {
  try {
    writeKeys({ telegramChatId: readKeys().telegramChatId || '' }); // Mantiene solo el chatId
    return NextResponse.json({ ok: true, message: 'API keys limpiadas. Ingresa las credenciales reales en Config → API Keys.' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
