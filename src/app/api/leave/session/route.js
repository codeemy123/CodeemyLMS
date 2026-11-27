// Leave Management Auth API — session create/delete
import { NextResponse } from 'next/server';
import { firebaseAuth } from '@/lib/server/firebase';
import { getPrisma } from '@/lib/prisma';
import { assertOrigin, ApiError, jsonBody, errorResponse } from '@/lib/server/api';
import { isConfiguredAdminEmail } from '@/lib/server/admin-identity';
import { leaveSessionCookie } from '@/lib/server/leave-auth';
export const runtime = 'nodejs';

function cookieOptions(request, maxAge) {
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || proto === 'https',
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
    try { token = await auth.verifyIdToken(body.idToken, false); }
    catch { throw new ApiError(401, 'Invalid sign-in token.'); }
    if (Date.now() / 1000 - token.auth_time > 600)
      throw new ApiError(401, 'Sign in again to create a session.');

    const db = getPrisma();
    let actor = await db.employees.findUnique({ where: { firebase_uid: token.uid }, select: { id: true, emp_role: true, status: true } });
    if (!actor && token.email) {
      if (token.email_verified !== true) {
        throw new ApiError(403, 'Verify your email address before signing in.');
      }
      actor = await db.employees.findFirst({ where: { email: { equals: token.email.trim().toLowerCase(), mode: 'insensitive' } }, select: { id: true, emp_role: true, status: true } });
      if (actor) await db.employees.update({ where: { id: actor.id }, data: { firebase_uid: token.uid } }).catch(() => {});
    }
    if (!actor && token.email_verified === true && isConfiguredAdminEmail(token.email)) {
      actor = await db.employees.create({
        data: {
          firebase_uid: token.uid,
          email: token.email.trim().toLowerCase(),
          full_name: token.name || 'System Administrator',
          emp_role: 'ADMIN',
          status: 'ACTIVE',
        },
        select: { id: true, emp_role: true, status: true },
      }).catch(() => null);
    }
    if (!actor) throw new ApiError(403, 'No employee account found. Contact your HR.');
    if (actor.status !== 'ACTIVE') throw new ApiError(403, 'Your account is not active.');

    let cookieValue;
    try { cookieValue = await auth.createSessionCookie(body.idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 }); }
    catch { cookieValue = body.idToken; }

    const response = NextResponse.json({ role: actor.emp_role });
    response.cookies.set(leaveSessionCookie, cookieValue, cookieOptions(request, 5 * 24 * 60 * 60));
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
    response.cookies.set(leaveSessionCookie, '', cookieOptions(request, 0));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
