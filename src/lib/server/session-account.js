import { ApiError } from './api.js';
import { registrationLoginMessage } from './registrations.js';
// Called only after Firebase has cryptographically verified the identity token.
export async function resolveSessionAccount(db, token) {
  const actor = await db.users.findUnique({
    where: { firebase_uid: token.uid },
    select: { id: true, role: true, status: true },
  });
  if (!actor) {
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
  return { role: actor.role };
}
