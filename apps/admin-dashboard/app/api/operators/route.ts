import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const DATA_DIR  = '/app/data';
const DATA_FILE = path.join(DATA_DIR, 'operators.json');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readOps(): any[] {
  try {
    ensureDir();
    if (!existsSync(DATA_FILE)) return [];
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  } catch { return []; }
}

function writeOps(ops: any[]) {
  ensureDir();
  writeFileSync(DATA_FILE, JSON.stringify(ops, null, 2), 'utf-8');
}

// GET /api/operators - list all operators (password excluded)
export async function GET() {
  const ops = readOps();
  const safe = ops.map(({ password: _p, ...o }) => o);
  return NextResponse.json(safe);
}

// POST /api/operators - create new operator
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ops = readOps();

    // Prevent duplicate alias or email
    const dup = ops.find(o =>
      o.alias?.toLowerCase() === body.alias?.toLowerCase() ||
      o.email?.toLowerCase() === body.email?.toLowerCase()
    );
    if (dup) {
      return NextResponse.json({ error: 'Alias o email ya existe' }, { status: 409 });
    }

    const newOp = {
      id: Date.now(),
      alias: body.alias || '',
      email: body.email || '',
      password: body.password || '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      totalOrders: 0,
      completedOrders: 0,
      totalVolumeUsdt: 0,
      totalVolumeFiat: 0,
      successRate: 0,
      p2pUsdtBalance: 0,
    };
    ops.push(newOp);
    writeOps(ops);

    const { password: _p, ...safeOp } = newOp;
    return NextResponse.json(safeOp, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
