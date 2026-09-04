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

// GET /api/operators/[id] - get operator info
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ops = readOps();
  const op = ops.find(o => String(o.id) === params.id);
  if (!op) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { password: _p, ...safe } = op;
  return NextResponse.json(safe);
}

// DELETE /api/operators/[id] - remove operator
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ops = readOps();
  const filtered = ops.filter(o => String(o.id) !== params.id);
  writeOps(filtered);
  return NextResponse.json({ ok: true });
}

// PATCH /api/operators/[id] - update credentials or stats
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const ops = readOps();
  const idx = ops.findIndex(o => String(o.id) === params.id);
  if (idx < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  if (body.email)    ops[idx].email    = body.email;
  if (body.password) ops[idx].password = body.password;
  
  if (body.action === 'increment_stats') {
      ops[idx].totalOrders = (ops[idx].totalOrders || 0) + 1;
      ops[idx].completedOrders = (ops[idx].completedOrders || 0) + 1;
      ops[idx].totalVolumeUsdt = (ops[idx].totalVolumeUsdt || 0) + Number(body.amountUsdt || 0);
      ops[idx].totalVolumeFiat = (ops[idx].totalVolumeFiat || 0) + Number(body.amountFiat || 0);
      ops[idx].p2pUsdtBalance = (ops[idx].p2pUsdtBalance || 0) + Number(body.profitUsdt || 0);
      
      // recalc success rate
      if (ops[idx].totalOrders > 0) {
         ops[idx].successRate = (ops[idx].completedOrders / ops[idx].totalOrders) * 100;
      } else {
         ops[idx].successRate = 0;
      }
  }

  writeOps(ops);
  return NextResponse.json({ ok: true });
}
