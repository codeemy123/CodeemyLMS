import { resolveSessionAccount } from '@/lib/server/session-account';
import { NextResponse } from 'next/server';
import { firebaseAuth } from '@/lib/server/firebase';
import { sessionCookie } from '@/lib/server/auth';
import { assertOrigin, ApiError, jsonBody, errorResponse } from '@/lib/server/api';
import { getPrisma } from '@/lib/prisma';
export const runtime = 'nodejs';

function sessionCookieOptions(request, maxAge) {
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();

  return {
    httpOnly: true,
    // The browser only reaches the app over HTTPS in production.  Do not rely
    // exclusively on a reverse proxy preserving x-forwarded-proto.
    secure:
      process.env.NODE_ENV === 'production' ||
      forwardedProtocol === 'https' ||
      new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}
export async function POST(request) {
  try {
    assertOrigin(request);
    const body = await jsonBody(request);
    if (typeof body.idToken !== 'string' || body.idToken.length > 10000)
      throw new ApiError(400, 'Missing identity token.');
    const auth = firebaseAuth();
    let token;
    try {
      token = await auth.verifyIdToken(body.idToken, false);
      console.log('[AUTH/SESSION] Token verified:', token?.email, 'uid:', token?.uid);
    } catch (err) {
      console.error('[AUTH/SESSION] verifyIdToken error:', err?.message || err);
      throw new ApiError(401, 'Invalid sign-in token.');
    }
    if (Date.now() / 1000 - token.auth_time > 600)
      throw new ApiError(401, 'Sign in again to create a session.');
    const db = getPrisma();
    const account = await resolveSessionAccount(db, token);
    console.log('[AUTH/SESSION] Account resolved:', account?.role, 'needsReg:', account?.needsRegistration);
    if (account.needsRegistration) {
      const response = NextResponse.json(account, { headers: { 'Cache-Control': 'no-store' } });
      response.cookies.set(sessionCookie, '', sessionCookieOptions(request, 0));
      return response;
    }
    let value;
    try {
      value = await auth.createSessionCookie(body.idToken, {
        expiresIn: 5 * 24 * 60 * 60 * 1000,
      });
      console.log('[AUTH/SESSION] Session cookie created successfully');
    } catch (cookieErr) {
      console.warn('[AUTH/SESSION] createSessionCookie failed, using idToken fallback:', cookieErr?.message);
      value = body.idToken;
    }
    const response = NextResponse.json({ role: account.role });
    response.cookies.set(
      sessionCookie,
      value,
      sessionCookieOptions(request, 5 * 24 * 60 * 60),
    );
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('[AUTH/SESSION] POST error:', error?.message || error);
    return errorResponse(error);
  }
}
export async function DELETE(request) {
  try {
    assertOrigin(request);
    const response = NextResponse.json({ signedOut: true });
    response.cookies.set(sessionCookie, '', sessionCookieOptions(request, 0));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
