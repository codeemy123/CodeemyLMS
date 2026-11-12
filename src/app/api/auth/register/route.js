import { assertOrigin, jsonBody, ApiError, errorResponse } from '@/lib/server/api';
import { firebaseAuth } from '@/lib/server/firebase';
import { getPrisma } from '@/lib/prisma';
import { submitRegistration, requireRegistrationPassword } from '@/lib/server/registrations';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    assertOrigin(request);
    const body = await jsonBody(request);
    if (typeof body.idToken !== 'string' || body.idToken.length > 10000)
      throw new ApiError(400, 'Sign in with Firebase to register.');
    let identity;
    try {
      identity = await firebaseAuth().verifyIdToken(body.idToken, true);
    } catch {
      throw new ApiError(401, 'Invalid registration identity. Please sign in again.');
    }
    if (Date.now() / 1000 - identity.auth_time > 300)
      throw new ApiError(401, 'Please sign in again to register.');
    const account = await firebaseAuth().getUser(identity.uid);
    requireRegistrationPassword(identity, account);
    return Response.json(
      await submitRegistration(getPrisma(), identity, { ...body, passwordReady: true }),
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
