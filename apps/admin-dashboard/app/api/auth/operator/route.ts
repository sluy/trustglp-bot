import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, mkdirSync } from 'fs';
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

// POST /api/auth/operator - authenticate operator and return JWT-like token
export async function POST(req: NextRequest) {
  try {
    const { loginId, password } = await req.json();

    if (!loginId || !password) {
      return NextResponse.json({ error: 'Credenciales requeridas' }, { status: 400 });
    }

    const ops = readOps();
    const op = ops.find(o =>
      (o.alias?.toLowerCase() === loginId.toLowerCase() ||
       o.email?.toLowerCase()  === loginId.toLowerCase()) &&
      o.password === password &&
      o.status === 'ACTIVE'
    );

    if (!op) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Generate a simple base64 token (same format as admin bypass)
    const payload = {
      userId: op.id,
      role: 'operator',
      alias: op.alias,
      email: op.email,
      exp: Date.now() + 86400000, // 24h
    };
    const accessToken = Buffer.from(JSON.stringify(payload)).toString('base64');

    const { password: _p, ...safeOp } = op;
    return NextResponse.json({ accessToken, operator: safeOp });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
