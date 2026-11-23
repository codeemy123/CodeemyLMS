import { ApiError } from './api.js';
import { adminIdentityIssue, isConfiguredAdminEmail } from './admin-identity.js';
import { registrationLoginMessage } from './registrations.js';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// Called only after Firebase has cryptographically verified the identity token.
export async function resolveSessionAccount(db, token, environment = process.env) {
  let actor = await db.users.findUnique({
    where: { firebase_uid: token.uid },
    select: { id: true, email: true, role: true, status: true },
  });

  const normalizedEmail = normalizeEmail(token?.email);

  // If not found by firebase_uid, check by email to support existing users
  if (!actor && normalizedEmail && typeof db.users.findFirst === 'function') {
    const existing = await db.users.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true, email: true, role: true, status: true },
    });
    if (existing) {
      actor = existing;
      if (typeof db.users.update === 'function') {
        await db.users.update({
          where: { id: existing.id },
          data: { firebase_uid: token.uid },
        });
      }
    }
  }

  // If this is the configured admin and not yet provisioned in DB, auto-provision
  if (!actor && isConfiguredAdminEmail(normalizedEmail, environment)) {
    if (typeof db.users.create === 'function') {
      try {
        actor = await db.users.create({
          data: {
            email: normalizedEmail,
            full_name: token.name || 'System Administrator',
            role: 'ADMIN',
            status: 'ACTIVE',
            firebase_uid: token.uid,
          },
          select: { id: true, email: true, role: true, status: true },
        });
      } catch {
        // Fallback if concurrent creation occurred
        if (typeof db.users.findFirst === 'function') {
          actor = await db.users.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
            select: { id: true, email: true, role: true, status: true },
          });
        }
      }
    }
  }

  if (!actor) {
    if (isConfiguredAdminEmail(token.email, environment))
      throw new ApiError(
        403,
        'The official administrator account is not provisioned. Contact the system administrator.',
      );
    if (
      token.firebase?.sign_in_provider === 'google.com' &&
      token.email_verified === true &&
      token.email
    )
      return {
        needsRegistration: true,
        profile: { email: token.email, fullName: token.name || '' },
      };
    throw new ApiError(403, 'Register your account first so your academy can review your access.');
  }

  // Ensure configured admin always has active ADMIN access
  if (
    isConfiguredAdminEmail(token.email, environment) ||
    isConfiguredAdminEmail(actor.email, environment)
  ) {
    if (actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
      if (typeof db.users.update === 'function') {
        actor = await db.users.update({
          where: { id: actor.id },
          data: { role: 'ADMIN', status: 'ACTIVE', firebase_uid: token.uid },
          select: { id: true, email: true, role: true, status: true },
        });
      }
    }
  }

  if (actor.status !== 'ACTIVE')
    throw new ApiError(403, await registrationLoginMessage(db, actor.id));
  if (!['ADMIN', 'MENTOR', 'STUDENT'].includes(actor.role))
    throw new ApiError(403, 'Account role is invalid.');

  if (actor.role === 'ADMIN') {
    const issue = adminIdentityIssue(token, actor, environment);
    if (issue) throw new ApiError(403, issue);
  } else if (
    isConfiguredAdminEmail(actor.email, environment) ||
    isConfiguredAdminEmail(token.email, environment)
  ) {
    throw new ApiError(403, 'The official administrator identity must have an active ADMIN role.');
  }

  return { role: actor.role };
}
