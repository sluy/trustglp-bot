import { NextResponse } from 'next/server';

export async function GET() {
    const pythonUrl = process.env.NODE_ENV === 'production' 
      ? 'http://auto-pay-bot:8000/api/engine/status' 
      : 'http://localhost:8000/api/engine/status';
    try {
        const res = await fetch(pythonUrl);
        return NextResponse.json(await res.json());
    } catch {
        return NextResponse.json({ ok: false, isRunning: false });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const action = body.action === 'start' ? 'start' : 'stop';
        const pythonUrl = process.env.NODE_ENV === 'production' 
          ? `http://auto-pay-bot:8000/api/engine/${action}` 
          : `http://localhost:8000/api/engine/${action}`;
        
        const res = await fetch(pythonUrl, { method: 'POST' });
        return NextResponse.json(await res.json());
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message });
    }
}
