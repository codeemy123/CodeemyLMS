import { NextResponse } from 'next/server';
export function proxy(request) {
  if (process.env.LMS_AUTH_ENABLED === 'false' && process.env.NODE_ENV !== 'production')
    return NextResponse.next();
  if (request.nextUrl.pathname.endsWith('/login'))
    return NextResponse.redirect(new URL('/login', request.url));
  if (!request.cookies.get('codeemy_session')?.value)
    return NextResponse.redirect(new URL('/login', request.url));
  // Cookie presence is only an early redirect. Node layouts verify it and the DB role.
  const headers = new Headers(request.headers);
  headers.set('x-codeemy-workspace', request.nextUrl.pathname.split('/')[1]);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/admin/:path*', '/mentor/:path*', '/student/:path*'] };
