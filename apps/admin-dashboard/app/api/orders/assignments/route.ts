import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = '/app/data';
const FILE_PATH = path.join(DATA_DIR, 'assignments.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  }
}

function readAssignments() {
  try {
    if (!existsSync(FILE_PATH)) return {};
    return JSON.parse(readFileSync(FILE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeAssignments(data: any) {
  ensureDataDir();
  try {
    writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing assignments:', e);
  }
}

export async function GET() {
  const data = readAssignments();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, operatorId, operatorName } = body;
    
    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'orderId is required' });
    }

    const data = readAssignments();
    
    // Prevent double assignment
    if (data[orderId] && data[orderId].operatorId !== operatorId) {
      return NextResponse.json({ 
        ok: false, 
        error: `Esta orden ya fue tomada por ${data[orderId].operatorName}` 
      });
    }

    data[orderId] = {
      operatorId,
      operatorName,
      assignedAt: Date.now()
    };
    
    writeAssignments(data);
    return NextResponse.json({ ok: true, assignments: data });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'orderId is required' });
    }

    const data = readAssignments();
    if (data[orderId]) {
      delete data[orderId];
      writeAssignments(data);
    }
    
    return NextResponse.json({ ok: true, assignments: data });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
