import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'active_strategies.json');

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStrategies(): Record<string, any> {
  try {
    ensureDir();
    if (!existsSync(DATA_FILE)) return {};
    const content = readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content) || {};
  } catch {
    return {};
  }
}

function writeStrategies(strategies: Record<string, any>) {
  ensureDir();
  writeFileSync(DATA_FILE, JSON.stringify(strategies, null, 2), 'utf-8');
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!payload || !payload.strategy_id) {
       return NextResponse.json({ success: false, error: 'Estrategia inválida' }, { status: 400 });
    }

    const bank = payload.bank || 'Banesco';
    const radarId = payload.radarId;
    const key = radarId || bank.toLowerCase();
    const strategies = readStrategies();
    
    // Store active strategy by key
    strategies[key] = payload;
    writeStrategies(strategies);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bank = searchParams.get('bank') || 'Banesco';
    const radarId = searchParams.get('radarId');
    const key = radarId || bank.toLowerCase();
    
    const strategies = readStrategies();
    const active = strategies[key] || null;
    
    return NextResponse.json(active);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
