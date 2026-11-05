import { NextResponse } from 'next/server';
import { firebaseAuth } from '@/lib/server/firebase';
import { sessionCookie } from '@/lib/server/auth';
import { assertOrigin, ApiError, jsonBody, errorResponse } from '@/lib/server/api';
import { getPrisma } from '@/lib/prisma';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    assertOrigin(request);
    const body = await jsonBody(request);
    if (typeof body.idToken !== 'string' || body.idToken.length > 10000)
      throw new ApiError(400, 'Missing identity token.');
    const auth = firebaseAuth();
    let token;
    try {
      token = await auth.verifyIdToken(body.idToken, true);
    } catch {
      throw new ApiError(401, 'Invalid sign-in token.');
    }
    if (Date.now() / 1000 - token.auth_time > 300)
      throw new ApiError(401, 'Sign in again to create a session.');
    const db = getPrisma();
    const actor = await db.users.findUnique({
      where: { firebase_uid: token.uid },
      select: { id: true, role: true, status: true },
    });
    if (!actor || actor.status !== 'ACTIVE')
      throw new ApiError(403, 'Ask your administrator to provision or activate your account.');
    const value = await auth.createSessionCookie(body.idToken, {
      expiresIn: 5 * 24 * 60 * 60 * 1000,
    });
    const response = NextResponse.json({ role: actor.role });
    response.cookies.set(sessionCookie, value, {
      httpOnly: true,
      secure:
        request.headers.get('x-forwarded-proto') === 'https' ||
        new URL(request.url).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 24 * 60 * 60,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request) {
  try {
    assertOrigin(request);
    const response = NextResponse.json({ signedOut: true });
    response.cookies.set(sessionCookie, '', {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
