import { ApiError, choice, text, uuid } from './api.js';

export const registrationActions = ['REGISTRATION_APPROVED', 'REGISTRATION_REJECTED'];

export async function submitRegistration(db, identity, body) {
  if (!identity.email) throw new ApiError(400, 'An email address is required.');
  const role = choice(body.role, ['STUDENT', 'MENTOR']);
  const fullName = text(body.fullName, 150);
  const phone = text(body.phone || '', 20, false);
  const details = {
    role,
    phone,
    college: text(body.college || '', 250, false),
    qualification: text(body.qualification || '', 500, false),
    message: text(body.message || '', 2000, false),
    emailVerified: identity.email_verified === true,
  };
  return db.$transaction(async (tx) => {
    const existing = await tx.users.findFirst({
      where: { OR: [{ firebase_uid: identity.uid }, { email: identity.email }] },
    });
    if (existing)
      throw new ApiError(
        409,
        'This account is already registered. Sign in to check your access or contact your academy.',
      );
    const user = await tx.users.create({
      data: {
        firebase_uid: identity.uid,
        email: identity.email,
        full_name: fullName,
        phone: phone || null,
        role,
        status: 'INACTIVE',
      },
    });
    const request = await tx.audit_logs.create({
      data: {
        user_id: user.id,
        entity_id: user.id,
        entity_type: 'account_registration',
        action: 'REGISTRATION_REQUESTED',
        details,
      },
    });
    const admins = await tx.users.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    if (admins.length)
      await tx.notifications.createMany({
        data: admins.map((admin) => ({
          user_id: admin.id,
          title: 'Account approval requested',
          message: `${fullName} requested ${role.toLowerCase()} access. Review Account Approvals.`,
          type: 'ACCOUNT_APPROVAL',
          reference_id: request.id,
        })),
      });
    return { requestId: request.id, status: 'PENDING' };
  });
}

export async function reviewRegistration(db, actor, requestId, body, verifyIdentity) {
  if (actor.role !== 'ADMIN')
    throw new ApiError(403, 'Only administrators can review registrations.');
  uuid(requestId);
  const decision = choice(body.decision, ['APPROVED', 'REJECTED']);
  const reason = text(body.reason || '', 2000, decision === 'REJECTED');
  return db.$transaction(
    async (tx) => {
      const registration = await tx.audit_logs.findFirst({
        where: {
          id: requestId,
          action: 'REGISTRATION_REQUESTED',
          entity_type: 'account_registration',
        },
      });
      if (!registration?.entity_id) throw new ApiError(404, 'Registration not found.');
      // Lock the account so two administrators cannot decide the same request concurrently.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${registration.entity_id}::uuid FOR UPDATE`;
      const user = await tx.users.findUnique({ where: { id: registration.entity_id } });
      if (!user) throw new ApiError(404, 'Applicant account not found.');
      const prior = await tx.audit_logs.findFirst({
        where: {
          entity_id: user.id,
          entity_type: 'account_registration',
          action: { in: registrationActions },
        },
      });
      if (prior || user.status !== 'INACTIVE')
        throw new ApiError(409, 'This request has already been reviewed. Refresh the list.');
      if (!['STUDENT', 'MENTOR'].includes(user.role))
        throw new ApiError(400, 'Invalid requested role.');
      if (decision === 'APPROVED') {
        const identity = await verifyIdentity(user.firebase_uid);
        if (identity.disabled || identity.email?.toLowerCase() !== user.email.toLowerCase())
          throw new ApiError(
            409,
            'Firebase identity changed or was disabled. Verify the applicant before approval.',
          );
        await tx.users.update({
          where: { id: user.id },
          data: { status: 'ACTIVE', updated_at: new Date() },
        });
      }
      await tx.audit_logs.create({
        data: {
          user_id: actor.id,
          entity_id: user.id,
          entity_type: 'account_registration',
          action: `REGISTRATION_${decision}`,
          details: { requestId, reason, role: user.role },
        },
      });
      await tx.notifications.create({
        data: {
          user_id: user.id,
          title: decision === 'APPROVED' ? 'Your account is approved' : 'Registration reviewed',
          message: reason || 'Your academy account is approved. You can now sign in.',
          type: 'ACCOUNT_APPROVAL',
          reference_id: requestId,
        },
      });
      return { status: decision, userId: user.id };
    },
    { timeout: 30000 },
  );
}

export async function registrationLoginMessage(db, userId) {
  const decision = await db.audit_logs.findFirst({
    where: {
      entity_id: userId,
      entity_type: 'account_registration',
      action: { in: registrationActions },
    },
    orderBy: { created_at: 'desc' },
  });
  if (decision?.action === 'REGISTRATION_REJECTED')
    return `Your registration was declined. ${decision.details?.reason || 'Contact your academy for details.'}`;
  const request = await db.audit_logs.findFirst({
    where: { entity_id: userId, action: 'REGISTRATION_REQUESTED' },
  });
  return request && !decision
    ? 'Your registration is waiting for administrator approval. Please try again after approval.'
    : 'Your account is inactive. Contact your administrator.';
}
