import { NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

export const dynamic = 'force-dynamic';

const RECEIPTS_DIR = path.join(os.tmpdir(), 'p2p-receipts');

// POST /api/bybit/receipt/upload
// Acepta JSON { imageBase64: "data:image/jpeg;base64,..." } (método preferido, sin límites FormData)
// o FormData con campo "image" (fallback)
// Returns: { ok: true, code: string, url: string }
export async function POST(req: Request) {
  try {
    let imageBase64: string | null = null;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // ── Método JSON (recomendado: imagen muy comprimida ~20-50KB) ──────────────
      const body = await req.json();
      imageBase64 = body.imageBase64 as string | null;
      if (!imageBase64) {
        return NextResponse.json({ ok: false, error: 'Campo imageBase64 requerido' });
      }
    } else if (contentType.includes('multipart/form-data')) {
      // ── Fallback FormData ───────────────────────────────────────────────────────
      const formData = await req.formData();
      const imageFile = formData.get('image') as File | null;
      if (!imageFile) {
        return NextResponse.json({ ok: false, error: 'No se recibió imagen' });
      }
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      imageBase64 = `data:${imageFile.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;
    } else {
      return NextResponse.json({ ok: false, error: `Content-Type no soportado: ${contentType}` });
    }

    // Validar y extraer datos de la imagen base64
    const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/s);
    if (!match) {
      return NextResponse.json({ ok: false, error: 'Formato de imagen inválido (debe ser data:image/...;base64,...)' });
    }
    const mimeType = match[1];
    const b64Data  = match[2];
    const buffer   = Buffer.from(b64Data, 'base64');

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg',
      'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif'
    };
    const ext = extMap[mimeType] || 'jpg';

    // Generar código único 8 chars y guardar
    const code = crypto.randomBytes(5).toString('base64url').slice(0, 8).toLowerCase();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 horas

    if (!existsSync(RECEIPTS_DIR)) {
      mkdirSync(RECEIPTS_DIR, { recursive: true });
    }

    const imgFile  = path.join(RECEIPTS_DIR, `${code}.${ext}`);
    const metaFile = path.join(RECEIPTS_DIR, `${code}.meta.json`);

    writeFileSync(imgFile, buffer);
    writeFileSync(metaFile, JSON.stringify({
      code, ext, expiresAt,
      createdAt: Date.now(),
      sizeBytes: buffer.length,
    }));

    // URL pública — prioridad: header host (dominio actual) > env var > req.url
    const host = req.headers.get('host') || req.headers.get('x-forwarded-host');
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';

    let receiptUrl: string;
    if (host) {
      receiptUrl = `${proto}://${host}/api/bybit/receipt/${code}`;
    } else if (publicBaseUrl) {
      receiptUrl = `${publicBaseUrl.replace(/\/$/, '')}/api/bybit/receipt/${code}`;
    } else {
      const reqUrl = new URL(req.url);
      receiptUrl = `${reqUrl.protocol}//${reqUrl.host}/api/bybit/receipt/${code}`;
    }

    return NextResponse.json({ ok: true, code, url: receiptUrl });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Error guardando imagen: ${e.message}` });
  }
}
