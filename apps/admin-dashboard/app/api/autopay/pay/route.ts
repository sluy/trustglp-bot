import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // In production (Docker), the python service is named "auto-pay-bot"
    // Locally it's "localhost"
    const pythonUrl = process.env.NODE_ENV === 'production' 
      ? 'http://auto-pay-bot:8000/api/pay' 
      : 'http://localhost:8000/api/pay';

    const res = await fetch(pythonUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: 'Proxy error: ' + error.message });
  }
}
