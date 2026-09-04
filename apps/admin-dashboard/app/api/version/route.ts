import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({ 
    version: 'v2026-05-14-1700',
    ok: true,
    timestamp: new Date().toISOString(),
    features: ['json-upload', 'non-blocking-pay', 'chat-detection', 'copy-raw']
  });
}
