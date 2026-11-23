import { ApiError } from './api.js';
import { adminIdentityIssue, isConfiguredAdminEmail } from './admin-identity.js';
import { registrationLoginMessage } from './registrations.js';
// Called only after Firebase has cryptographically verified the identity token.
export async function resolveSessionAccount(db, token, environment = process.env) {
  const actor = await db.users.findUnique({
    where: { firebase_uid: token.uid },
    select: { id: true, email: true, role: true, status: true },
  });
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
  if (actor.status !== 'ACTIVE')
    throw new ApiError(403, await registrationLoginMessage(db, actor.id));
  if (!['ADMIN', 'MENTOR', 'STUDENT'].includes(actor.role))
    throw new ApiError(403, 'Account role is invalid.');

  if (actor.role === 'ADMIN') {
    const issue = adminIdentityIssue(token, actor, environment);
    if (issue) throw new ApiError(403, issue);
  } else if (isConfiguredAdminEmail(actor.email, environment) || isConfiguredAdminEmail(token.email, environment)) {
    throw new ApiError(403, 'The official administrator identity must have an active ADMIN role.');
  }

  return { role: actor.role };
}
