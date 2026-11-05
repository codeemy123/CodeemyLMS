import { authenticated } from '@/lib/server/auth';
import { courseScope, requireCourse } from '@/lib/server/data-access';
import { jsonBody, roleAllowed, uuid, text, numeric, ApiError } from '@/lib/server/api';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => {
  const assignments = await db.assignments.findMany({
    where: {
      courses: courseScope(actor),
      ...(actor.role === 'STUDENT'
        ? {
            OR: [
              { batch_id: null },
              { batches: { batch_members: { some: { student_id: actor.id } } } },
            ],
          }
        : actor.role === 'MENTOR'
          ? { OR: [{ batch_id: null }, { batches: { mentor_id: actor.id } }] }
          : {}),
    },
    include: {
      courses: { select: { id: true, title: true } },
      assignment_submissions: {
        where: actor.role === 'STUDENT' ? { student_id: actor.id } : {},
        select: {
          id: true,
          student_id: true,
          submission_text: true,
          file_url: true,
          marks_awarded: true,
          feedback: true,
          status: true,
          users_assignment_submissions_student_idTousers: { select: { full_name: true } },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
  if (actor.role === 'MENTOR') {
    const members = await db.batch_members.findMany({
      where: { batches: { mentor_id: actor.id } },
      include: { batches: { select: { course_id: true } } },
    });
    for (const assignment of assignments)
      assignment.assignment_submissions = assignment.assignment_submissions.filter((submission) =>
        members.some(
          (m) =>
            m.student_id === submission.student_id &&
            m.batches.course_id === assignment.course_id &&
            (!assignment.batch_id || m.batch_id === assignment.batch_id),
        ),
      );
  }
  return { assignments };
});
export const POST = authenticated(async (request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const body = await jsonBody(request);
  const courseId = uuid(body.courseId);
  await requireCourse(db, actor, courseId);
  const batchId = body.batchId ? uuid(body.batchId) : null;
  if (batchId && !(await db.batches.findFirst({ where: { id: batchId, course_id: courseId } })))
    throw new ApiError(400, 'Batch must belong to this course.');
  const due = body.dueDate ? new Date(body.dueDate) : null;
  if (due && !Number.isFinite(due.getTime())) throw new ApiError(400, 'Invalid due date.');
  return {
    assignment: await db.assignments.create({
      data: {
        course_id: courseId,
        batch_id: batchId,
        title: text(body.title),
        description: text(body.description || '', 20000, false),
        total_marks: numeric(Number(body.totalMarks || 100), 1, 100000),
        due_date: due,
        created_by: actor.id,
      },
    }),
  };
});
