import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/server/auth';
export async function proxy(request) {
  if (process.env.LMS_AUTH_ENABLED === 'false' && process.env.NODE_ENV !== 'production')
    return NextResponse.next();
  if (request.nextUrl.pathname.endsWith('/login'))
    return NextResponse.redirect(new URL('/login', request.url));
  try {
    const actor = await requireActor(request);
    const section = request.nextUrl.pathname.split('/')[1];
    if (section !== actor.role.toLowerCase())
      return NextResponse.redirect(
        new URL('/' + actor.role.toLowerCase() + '/dashboard', request.url),
      );
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
export const config = { matcher: ['/admin/:path*', '/mentor/:path*', '/student/:path*'] };
