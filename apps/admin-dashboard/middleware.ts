import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CLIENT_SLUG = process.env.NEXT_PUBLIC_CLIENT_SLUG || 'telecambios-ve';
const JWT_COOKIE  = `${CLIENT_SLUG}_jwt`;

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // ── Demo Mode: skip ALL auth for free demo access ────────────────
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.next();
  }

  // ── Protección de rutas /admin (Basic Auth de borde) ──────────────
  if (url.pathname.startsWith('/admin')) {
    // En desarrollo: omitir Basic Auth para facilitar testing
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.next();
    }

    const basicAuth    = req.headers.get('authorization');
    const AdminPassword = process.env.ADMIN_PASSWORD || 'admin147258';

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');
      if (user === 'admin' && pwd === AdminPassword) {
        return NextResponse.next();
      }
    }

    return new NextResponse(`Acceso Restringido — ${process.env.NEXT_PUBLIC_CLIENT_NAME || 'Telecambios VE'}`, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Secure Admin Area"' },
    });
  }

  // ── Protección de rutas /portal/dashboard (JWT cookie) ────────────
  if (url.pathname.startsWith('/portal/dashboard')) {
    const token = req.cookies.get(JWT_COOKIE);
    if (!token) {
      return NextResponse.redirect(new URL('/portal/login', req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/portal/dashboard/:path*'],
};
