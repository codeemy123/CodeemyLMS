import { getPrisma } from '@/lib/prisma';
import { firebaseAuth } from './firebase.js';
import { ApiError } from './api.js';
import { isConfiguredAdminEmail } from './admin-identity.js';
import { requireActor } from './auth.js';
import { getLeaveRoleDashboard, MANAGER_ROLES } from '@/lib/leave-roles.js';
import { cookies } from 'next/headers';

export const leaveSessionCookie = 'codeemy_leave_session';

export async function requireLeaveActor(request) {
  const auth = firebaseAuth();
  let cookieVal;
  if (request && request.cookies) {
    cookieVal = request.cookies.get?.(leaveSessionCookie)?.value;
  } else {
    const store = await cookies();
    cookieVal = store.get(leaveSessionCookie)?.value;
  }
  const bearer = request?.headers?.get?.('authorization');
  if (!cookieVal && !bearer?.startsWith('Bearer ')) throw new ApiError(401, 'Please sign in.');
  let decoded;
  try {
    if (cookieVal) {
      try { decoded = await auth.verifySessionCookie(cookieVal, false); }
      catch { decoded = await auth.verifyIdToken(cookieVal, false); }
    } else {
      decoded = await auth.verifyIdToken(bearer.slice(7), false);
    }
  } catch {
    throw new ApiError(401, 'Session expired. Please sign in again.');
  }
  const db = getPrisma();
  let actor = await db.employees.findUnique({
    where: { firebase_uid: decoded.uid },
    select: { id: true, full_name: true, email: true, emp_role: true, status: true, team_leader_id: true },
  });
  if (!actor && decoded.email) {
    actor = await db.employees.findFirst({
      where: { email: { equals: decoded.email.trim().toLowerCase(), mode: 'insensitive' } },
      select: { id: true, full_name: true, email: true, emp_role: true, status: true, team_leader_id: true },
    });
    if (actor) {
      await db.employees.update({ where: { id: actor.id }, data: { firebase_uid: decoded.uid } }).catch(() => {});
    }
  }
  if (!actor && isConfiguredAdminEmail(decoded.email)) {
    actor = await db.employees.create({
      data: {
        firebase_uid: decoded.uid,
        email: decoded.email.trim().toLowerCase(),
        full_name: decoded.name || 'System Administrator',
        emp_role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: { id: true, full_name: true, email: true, emp_role: true, status: true, team_leader_id: true },
    }).catch(() => null);
  }
  if (!actor || actor.status !== 'ACTIVE') throw new ApiError(403, 'Your employee account is not active.');
  return actor;
}

/**
 * Allows either a Leave-portal actor with one of `allowedRoles`, OR an LMS Admin
 * authenticated via the main LMS session cookie (for /admin/leaves).
 */
export async function requireLeaveOrLmsAdmin(request, allowedRoles = MANAGER_ROLES) {
  try {
    const actor = await requireLeaveActor(request);
    if (allowedRoles.includes(actor.emp_role)) return actor;
  } catch {
    // Fall through to check LMS Admin session
  }
  const lmsActor = await requireActor(request);
  if (lmsActor.role !== 'ADMIN') {
    throw new ApiError(403, 'Administrator access is required.');
  }
  const db = getPrisma();
  let emp = await db.employees.findFirst({
    where: { email: { equals: lmsActor.email.trim().toLowerCase(), mode: 'insensitive' } },
    select: { id: true, full_name: true, email: true, emp_role: true, status: true, team_leader_id: true },
  });
  if (!emp) {
    emp = await db.employees.create({
      data: {
        firebase_uid: lmsActor.id,
        email: lmsActor.email.trim().toLowerCase(),
        full_name: lmsActor.full_name || 'System Administrator',
        emp_role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: { id: true, full_name: true, email: true, emp_role: true, status: true, team_leader_id: true },
    });
  }
  return emp;
}

export function leaveAuthenticated(handler) {
  return async (request, context) => {
    try {
      const actor = await requireLeaveActor(request);
      const result = await handler(request, context, actor, getPrisma());
      if (result instanceof Response) return result;
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const status = error.status || 500;
      const message = error.status ? error.message : 'Request failed.';
      return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}

export function leaveAdminAuthenticated(handler, allowedRoles = MANAGER_ROLES) {
  return async (request, context) => {
    try {
      const actor = await requireLeaveOrLmsAdmin(request, allowedRoles);
      const result = await handler(request, context, actor, getPrisma());
      if (result instanceof Response) return result;
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const status = error.status || 500;
      const message = error.status ? error.message : 'Request failed.';
      return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}

export async function requireLeaveWorkspace(allowedRoles) {
  const store = await cookies();
  const cookieVal = store.get(leaveSessionCookie)?.value;
  if (!cookieVal) {
    const { redirect } = await import('next/navigation');
    redirect('/leave/login');
  }
  const auth = firebaseAuth();
  let decoded;
  try {
    try { decoded = await auth.verifySessionCookie(cookieVal, false); }
    catch { decoded = await auth.verifyIdToken(cookieVal, false); }
  } catch {
    const { redirect } = await import('next/navigation');
    redirect('/leave/login');
  }
  const db = getPrisma();
  let actor = await db.employees.findUnique({
    where: { firebase_uid: decoded.uid },
    select: { id: true, full_name: true, email: true, emp_role: true, status: true, team_leader_id: true, profile_image: true },
  });
  if (!actor && decoded.email) {
    actor = await db.employees.findFirst({
      where: { email: { equals: decoded.email.trim().toLowerCase(), mode: 'insensitive' } },
      select: { id: true, full_name: true, email: true, emp_role: true, status: true, team_leader_id: true, profile_image: true },
    });
  }
  if (!actor) {
    const { redirect } = await import('next/navigation');
    redirect('/leave/login');
  }
  if (!allowedRoles.includes(actor.emp_role)) {
    const { redirect } = await import('next/navigation');
    redirect(getLeaveRoleDashboard(actor.emp_role) || '/leave/login');
  }
  return actor;
}
