import { getPrisma } from '@/lib/prisma';
import { adminIdentityIssue, isConfiguredAdminEmail } from './admin-identity.js';
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
    if (cookie) {
      try {
        decoded = await auth.verifySessionCookie(cookie, false);
      } catch {
        decoded = await auth.verifyIdToken(cookie, false);
      }
    } else {
      decoded = await auth.verifyIdToken(bearer.slice(7), false);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Your session has expired. Please sign in.');
  }
  let actor = await getPrisma().users.findUnique({
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

  if (!actor && decoded.email) {
    const normalized = decoded.email.trim().toLowerCase();
    actor = await getPrisma().users.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        status: true,
        profile_image: true,
      },
    });
    if (actor) {
      await getPrisma().users.update({
        where: { id: actor.id },
        data: { firebase_uid: decoded.uid },
      }).catch(() => {});
    }
  }

  if (!actor && isConfiguredAdminEmail(decoded.email)) {
    try {
      actor = await getPrisma().users.create({
        data: {
          email: decoded.email.trim().toLowerCase(),
          full_name: decoded.name || 'System Administrator',
          role: 'ADMIN',
          status: 'ACTIVE',
          firebase_uid: decoded.uid,
        },
        select: {
          id: true,
          full_name: true,
          email: true,
          role: true,
          status: true,
          profile_image: true,
        },
      });
    } catch {
      actor = {
        id: decoded.uid,
        full_name: decoded.name || 'System Administrator',
        email: decoded.email,
        role: 'ADMIN',
        status: 'ACTIVE',
      };
    }
  }
  if (!actor || actor.status !== 'ACTIVE')
    throw new ApiError(403, 'Your account is not active or has not been provisioned.');
  if (!['ADMIN', 'MENTOR', 'STUDENT'].includes(actor.role))
    throw new ApiError(403, 'Account role is invalid.');

  if (actor.role === 'ADMIN') {
    const issue = adminIdentityIssue(decoded, actor);
    if (issue) throw new ApiError(403, issue);
  } else if (isConfiguredAdminEmail(actor.email) || isConfiguredAdminEmail(decoded.email)) {
    throw new ApiError(403, 'The official administrator identity must have an active ADMIN role.');
  }
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
