import { getPrisma } from '@/lib/prisma';
import { firebaseAuth } from './firebase.js';
import { ApiError, assertOrigin, errorResponse } from './api.js';
export const sessionCookie = 'codeemy_session';
export async function requireActor(request) {
  const bearer = request.headers.get('authorization');
  const cookie = request.cookies?.get(sessionCookie)?.value;
  if (!cookie && !bearer?.startsWith('Bearer ')) throw new ApiError(401, 'Please sign in.');
  let decoded;
  try {
    const auth = firebaseAuth();
    decoded = cookie
      ? await auth.verifySessionCookie(cookie, true)
      : await auth.verifyIdToken(bearer.slice(7), true);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Your session has expired. Please sign in.');
  }
  const actor = await getPrisma().users.findUnique({
    where: { firebase_uid: decoded.uid },
    select: {
      id: true,
      full_name: true,
      email: true,
      role: true,
      status: true,
      profile_image: true,
    },
  });
  if (!actor || actor.status !== 'ACTIVE')
    throw new ApiError(403, 'Your account is not active or has not been provisioned.');
  return actor;
}
export function authenticated(handler) {
  return async (request, context) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) assertOrigin(request);
      const actor = await requireActor(request);
      const result = await handler(request, context, actor, getPrisma());
      if (result instanceof Response) return result;
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
