import { authenticated } from '@/lib/server/auth';
import { firebaseAuth } from '@/lib/server/firebase';
import { roleAllowed, jsonBody, text, choice, ApiError } from '@/lib/server/api';
import { ensureAcademicIdentity } from '@/lib/server/academic-identity';
export const runtime = 'nodejs';
export const POST = authenticated(async (request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const body = await jsonBody(request);
  const uid = text(body.firebaseUid, 128);
  const role = choice(body.role, ['STUDENT', 'MENTOR']);
  let identity;
  try {
    identity = await firebaseAuth().getUser(uid);
  } catch {
    throw new ApiError(400, 'Firebase user could not be verified.');
  }
  if (!identity.email || identity.disabled)
    throw new ApiError(400, 'An active Firebase user with email is required.');
  const existing = await db.users.findFirst({
    where: { OR: [{ firebase_uid: uid }, { email: identity.email }] },
  });
  if (existing)
    throw new ApiError(409, 'Account already mapped. Existing permissions were preserved.');
  const user = await db.$transaction(async (tx) => {
    const user = await tx.users.create({
      data: {
        firebase_uid: uid,
        email: identity.email,
        full_name: text(body.fullName, 150),
        role,
        status: 'ACTIVE',
        created_at: new Date(identity.metadata.creationTime),
      },
      select: { id: true, email: true, role: true, status: true },
    });
    await ensureAcademicIdentity(tx, user, { createdAt: new Date(identity.metadata.creationTime) });
    return user;
  });
  return { user };
});
