import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const pythonUrl = process.env.NODE_ENV === 'production' 
      ? 'http://auto-pay-bot:8000/api/engine/test-rpa' 
      : 'http://localhost:8000/api/engine/test-rpa';
      
    try {
        const body = await req.json();
        const res = await fetch(pythonUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message });
    }
}
