import { ApiError, roleAllowed } from './api.js';
export function courseScope(actor) {
  if (actor.role === 'ADMIN') return {};
  if (actor.role === 'MENTOR')
    return { OR: [{ mentor_id: actor.id }, { batches: { some: { mentor_id: actor.id } } }] };
  return {
    status: 'PUBLISHED',
    OR: [
      { enrollments: { some: { student_id: actor.id, status: { in: ['ACTIVE', 'COMPLETED'] } } } },
      { batches: { some: { batch_members: { some: { student_id: actor.id } } } } },
    ],
  };
}
export function sessionScope(actor) {
  if (actor.role === 'ADMIN') return {};
  if (actor.role === 'MENTOR')
    return { OR: [{ mentor_id: actor.id }, { batches: { mentor_id: actor.id } }] };
  return { batches: { batch_members: { some: { student_id: actor.id } } } };
}
export async function requireCourse(db, actor, id) {
  const course = await db.courses.findFirst({ where: { id, ...courseScope(actor) } });
  if (!course) throw new ApiError(404, 'Course not found or not assigned.');
  return course;
}
export async function requireSession(db, actor, id) {
  const session = await db.class_sessions.findFirst({
    where: { id, ...sessionScope(actor) },
    include: { batches: { include: { batch_members: true } } },
  });
  if (!session) throw new ApiError(404, 'Class session not found or not assigned.');
  return session;
}
export async function saveAttendance(db, actor, sessionId, marks) {
  roleAllowed(actor, ['ADMIN', 'MENTOR']);
  const session = await requireSession(db, actor, sessionId);
  const roster = new Set(session.batches.batch_members.map((m) => m.student_id));
  const seen = new Set(),
    saved = [];
  for (const item of marks) {
    if (
      !roster.has(item.studentId) ||
      seen.has(item.studentId) ||
      !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(item.status)
    )
      throw new ApiError(400, 'Invalid attendance entry.');
    seen.add(item.studentId);
    const key = { session_id: sessionId, student_id: item.studentId };
    const previous = await db.attendance.findUnique({ where: { session_id_student_id: key } });
    saved.push(
      await db.attendance.upsert({
        where: { session_id_student_id: key },
        create: { ...key, status: item.status },
        update: { status: item.status, marked_at: new Date() },
      }),
    );
    if (previous?.status !== item.status)
      await db.notifications.create({
        data: {
          user_id: item.studentId,
          title: 'Attendance updated',
          message: `${session.title}: ${item.status.toLowerCase()}`,
          type: 'ATTENDANCE',
          reference_id: sessionId,
        },
      });
  }
  return saved;
}
export async function evaluateSubmission(db, actor, kind, id, marks, feedback) {
  roleAllowed(actor, ['ADMIN', 'MENTOR']);
  if (!['assignment', 'project'].includes(kind))
    throw new ApiError(400, 'Invalid submission type.');
  const assignment = kind === 'assignment';
  const submission = await db[
    assignment ? 'assignment_submissions' : 'project_submissions'
  ].findUnique({ where: { id }, include: { [assignment ? 'assignments' : 'projects']: true } });
  if (!submission) throw new ApiError(404, 'Submission not found.');
  const work = submission[assignment ? 'assignments' : 'projects'];
  const course = await requireCourse(db, actor, work.course_id);
  if (actor.role === 'MENTOR') {
    const scope = await db.batch_members.findFirst({
      where: {
        student_id: submission.student_id,
        batches: {
          course_id: course.id,
          mentor_id: actor.id,
          ...(assignment && work.batch_id ? { id: work.batch_id } : {}),
        },
      },
    });
    if (!scope) throw new ApiError(403, 'Student is not assigned to your batch.');
  }
  const maximum = assignment ? Number(work.total_marks) : 100;
  if (marks < 0 || marks > maximum) throw new ApiError(400, 'Marks exceed the configured maximum.');
  const updated = await db[assignment ? 'assignment_submissions' : 'project_submissions'].update({
    where: { id },
    data: {
      marks_awarded: marks,
      feedback,
      ...(assignment
        ? { evaluated_by: actor.id, evaluated_at: new Date(), status: 'EVALUATED' }
        : {}),
    },
  });
  await db.notifications.create({
    data: {
      user_id: submission.student_id,
      title: 'Submission evaluated',
      message: `${work.title}: ${marks}/${maximum}. ${feedback}`,
      type: 'EVALUATION',
      reference_id: id,
    },
  });
  return updated;
}
