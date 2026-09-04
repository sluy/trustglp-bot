import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Utilizar un directorio relativo seguro (funcionará local y en Docker)
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'radar_config.json');

export interface RadarConfig {
  id: string;
  exchange: 'binance' | 'bybit';
  paymentMethod: string;
  capitalUsdt: number;
  vitalSpreadPct: number;
  sellActive: boolean;
  buyActive: boolean;
  sellAdId?: string;
  buyAdId?: string;
  customLimits?: number[];
  pricingMode?: 'agresivo' | 'neutro';
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readRadars(): RadarConfig[] {
  try {
    ensureDir();
    if (!existsSync(DATA_FILE)) return [];
    const content = readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content) as RadarConfig[];
  } catch {
    return [];
  }
}

function writeRadars(radars: RadarConfig[]) {
  ensureDir();
  writeFileSync(DATA_FILE, JSON.stringify(radars, null, 2), 'utf-8');
}

// GET all radars
export async function GET() {
  const radars = readRadars();
  return NextResponse.json({ ok: true, data: radars });
}

// POST create or update radar
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RadarConfig;
    if (!body.id || !body.exchange || !body.paymentMethod) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (id, exchange, paymentMethod)' }, { status: 400 });
    }

    const radars = readRadars();
    const existingIndex = radars.findIndex(r => r.id === body.id);

    if (existingIndex >= 0) {
      radars[existingIndex] = { ...radars[existingIndex], ...body };
    } else {
      radars.push({
        id: body.id,
        exchange: body.exchange,
        paymentMethod: body.paymentMethod,
        capitalUsdt: body.capitalUsdt ?? 1000,
        vitalSpreadPct: body.vitalSpreadPct ?? 1.5,
        sellActive: body.sellActive ?? false,
        buyActive: body.buyActive ?? false,
        sellAdId: body.sellAdId || '',
        buyAdId: body.buyAdId || '',
        customLimits: body.customLimits,
        pricingMode: body.pricingMode || 'agresivo'
      });
    }

    writeRadars(radars);
    return NextResponse.json({ ok: true, data: radars });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE a radar by id
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Falta el ID' }, { status: 400 });
    }

    let radars = readRadars();
    radars = radars.filter(r => r.id !== id);
    writeRadars(radars);
    
    return NextResponse.json({ ok: true, data: radars });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
