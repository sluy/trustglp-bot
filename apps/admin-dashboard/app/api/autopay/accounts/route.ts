import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getEngineApiUrl() {
  return process.env.NODE_ENV === 'production' 
    ? 'http://auto-pay-bot:8000' 
    : 'http://localhost:8000';
}

export async function GET() {
  try {
    const res = await fetch(`${getEngineApiUrl()}/api/engine/accounts`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${getEngineApiUrl()}/api/engine/accounts/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
