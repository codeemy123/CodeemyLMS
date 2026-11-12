import { ApiError, uuid, text, roleAllowed, choice } from './api.js';
import { requireCourse } from './data-access.js';
const REQUEST = 'ASSESSMENT_REOPEN_REQUESTED',
  APPROVE = 'ASSESSMENT_REOPEN_APPROVED',
  REJECT = 'ASSESSMENT_REOPEN_REJECTED';
export async function listReopenRequests(db, actor) {
  roleAllowed(actor, ['ADMIN', 'STUDENT']);
  const rows = await db.audit_logs.findMany({
    where: { action: REQUEST, ...(actor.role === 'STUDENT' ? { user_id: actor.id } : {}) },
    include: { users: { select: { full_name: true, email: true } } },
    orderBy: { created_at: 'desc' },
  });
  const reviews = await db.audit_logs.findMany({
    where: { action: { in: [APPROVE, REJECT] }, entity_id: { in: rows.map((r) => r.id) } },
    orderBy: { created_at: 'desc' },
  });
  const used = await db.audit_logs.findMany({
    where: { action: 'ASSESSMENT_REOPEN_USED', entity_id: { in: reviews.map((r) => r.id) } },
  });
  return {
    requests: rows.map((r) => {
      const review = reviews.find((d) => d.entity_id === r.id);
      return {
        id: r.id,
        studentId: r.user_id,
        student: r.users,
        attemptId: r.entity_id,
        ...r.details,
        requestedAt: r.created_at,
        status: review ? (review.action === APPROVE ? 'APPROVED' : 'REJECTED') : 'PENDING',
        reviewReason: review?.details?.reason || '',
        openAt: review?.details?.openAt,
        closeAt: review?.details?.closeAt,
        used: used.some((u) => u.entity_id === review?.id),
      };
    }),
  };
}
async function assignedAssessment(tx, actor, assessmentId) {
  const assessment = await tx.assessments.findUnique({ where: { id: assessmentId } });
  if (!assessment || assessment.status !== 'PUBLISHED')
    throw new ApiError(404, 'Assessment is not available.');
  await requireCourse(tx, actor, assessment.course_id);
  if (
    assessment.batch_id &&
    !(await tx.batch_members.findUnique({
      where: { batch_id_student_id: { batch_id: assessment.batch_id, student_id: actor.id } },
    }))
  )
    throw new ApiError(404, 'Assessment is not assigned to your batch.');
  return assessment;
}
export async function requestAssessmentReopen(db, actor, body) {
  roleAllowed(actor, ['STUDENT']);
  const attemptId = uuid(body.attemptId),
    reason = text(body.reason, 2000);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${actor.id}::uuid FOR UPDATE`;
      const attempt = await tx.assessment_attempts.findFirst({
        where: { id: attemptId, student_id: actor.id },
      });
      if (!attempt || attempt.status === 'IN_PROGRESS')
        throw new ApiError(409, 'Finish the current attempt before requesting access.');
      const latest = await tx.assessment_attempts.findFirst({
        where: { assessment_id: attempt.assessment_id, student_id: actor.id },
        orderBy: [{ started_at: 'desc' }, { created_at: 'desc' }],
      });
      if (latest.id !== attempt.id)
        throw new ApiError(409, 'Request access for your latest attempt.');
      const assessment = await assignedAssessment(tx, actor, attempt.assessment_id);
      const prior = (await listReopenRequests(tx, actor)).requests.filter(
        (r) => r.attemptId === attemptId,
      );
      if (
        prior.some(
          (r) =>
            r.status === 'PENDING' ||
            (r.status === 'APPROVED' && !r.used && new Date(r.closeAt) > new Date()),
        )
      )
        throw new ApiError(409, 'An access request is already pending or approved.');
      const end = await tx.audit_logs.findFirst({
        where: { action: 'ASSESSMENT_FINISHED', entity_id: attempt.id },
        orderBy: { created_at: 'desc' },
      });
      const request = await tx.audit_logs.create({
        data: {
          user_id: actor.id,
          action: REQUEST,
          entity_type: 'assessment_attempts',
          entity_id: attempt.id,
          details: {
            reason,
            assessmentId: assessment.id,
            assessmentTitle: assessment.title,
            closedReason: end?.details?.reason || 'submitted',
          },
        },
      });
      const admins = await tx.users.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true },
      });
      if (admins.length)
        await tx.notifications.createMany({
          data: admins.map((a) => ({
            user_id: a.id,
            title: 'Assessment access requested',
            message: `${actor.full_name}: ${assessment.title}. Reason: ${reason}`,
            type: 'ASSESSMENT_REOPEN',
            reference_id: request.id,
          })),
        });
      return { requestId: request.id, status: 'PENDING' };
    },
    { timeout: 30000 },
  );
}
export async function reviewAssessmentReopen(db, actor, body) {
  roleAllowed(actor, ['ADMIN']);
  const requestId = uuid(body.requestId),
    decision = choice(body.decision, ['APPROVED', 'REJECTED']),
    reason = text(body.reason || '', 2000, decision === 'REJECTED');
  let openAt, closeAt;
  if (decision === 'APPROVED') {
    openAt = new Date(body.openAt || Date.now());
    closeAt = new Date(body.closeAt);
    if (
      !Number.isFinite(openAt.getTime()) ||
      !Number.isFinite(closeAt.getTime()) ||
      closeAt <= openAt ||
      closeAt <= new Date()
    )
      throw new ApiError(400, 'Choose a valid future access window.');
  }
  return db.$transaction(
    async (tx) => {
      const request = await tx.audit_logs.findFirst({ where: { id: requestId, action: REQUEST } });
      if (!request?.user_id) throw new ApiError(404, 'Request not found.');
      await tx.$queryRaw`SELECT id FROM users WHERE id=${request.user_id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM audit_logs WHERE id=${request.id}::uuid FOR UPDATE`;
      if (
        await tx.audit_logs.findFirst({
          where: { entity_id: request.id, action: { in: [APPROVE, REJECT] } },
        })
      )
        throw new ApiError(409, 'This request has already been reviewed.');
      const student = await tx.users.findUnique({ where: { id: request.user_id } });
      if (student.status !== 'ACTIVE' || student.role !== 'STUDENT')
        throw new ApiError(409, 'Student account is not active.');
      if (decision === 'APPROVED') {
        const latest = await tx.assessment_attempts.findFirst({
          where: { assessment_id: request.details.assessmentId, student_id: student.id },
          orderBy: [{ started_at: 'desc' }, { created_at: 'desc' }],
        });
        if (!latest || latest.id !== request.entity_id || latest.status === 'IN_PROGRESS')
          throw new ApiError(409, 'The attempt changed. Refresh this request.');
        await assignedAssessment(tx, student, request.details.assessmentId);
      }
      await tx.audit_logs.create({
        data: {
          user_id: actor.id,
          action: decision === 'APPROVED' ? APPROVE : REJECT,
          entity_type: 'assessment_reopen',
          entity_id: request.id,
          details: {
            attemptId: request.entity_id,
            studentId: student.id,
            assessmentId: request.details.assessmentId,
            reason,
            ...(decision === 'APPROVED'
              ? { openAt: openAt.toISOString(), closeAt: closeAt.toISOString() }
              : {}),
          },
        },
      });
      await tx.notifications.create({
        data: {
          user_id: student.id,
          title:
            decision === 'APPROVED'
              ? 'Assessment access approved'
              : 'Assessment access request reviewed',
          message:
            decision === 'APPROVED'
              ? `${request.details.assessmentTitle}: one new attempt is available during the approved window.`
              : reason,
          type: 'ASSESSMENT_REOPEN',
          reference_id: request.id,
        },
      });
      return { status: decision };
    },
    { timeout: 30000 },
  );
}
export async function approvedReopen(tx, actor, attempt) {
  const grants = await tx.audit_logs.findMany({
    where: { action: APPROVE, details: { path: ['attemptId'], equals: attempt.id } },
    orderBy: { created_at: 'desc' },
  });
  for (const grant of grants) {
    if (grant.details.studentId !== actor.id) continue;
    if (
      await tx.audit_logs.findFirst({
        where: { action: 'ASSESSMENT_REOPEN_USED', entity_id: grant.id },
      })
    )
      continue;
    const now = new Date(),
      openAt = new Date(grant.details.openAt),
      closeAt = new Date(grant.details.closeAt);
    if (now < openAt || now >= closeAt)
      throw new ApiError(409, 'Your approved access window is not open.');
    return grant;
  }
  throw new ApiError(403, 'One attempt only. Request Admin approval to reopen this assessment.');
}
export async function assessmentAttemptWindow(tx, attempt, assessment) {
  const row = await tx.audit_logs.findFirst({
    where: {
      action: 'ASSESSMENT_REOPEN_STARTED',
      entity_id: attempt.id,
      user_id: attempt.student_id,
    },
  });
  return row
    ? {
        ...assessment,
        start_at: new Date(row.details.openAt),
        end_at: new Date(row.details.closeAt),
      }
    : assessment;
}
