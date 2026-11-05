import { authenticated } from '@/lib/server/auth';
import { courseScope } from '@/lib/server/data-access';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => {
  const student = actor.role === 'STUDENT' ? { student_id: actor.id } : {};
  const mentor =
    actor.role === 'MENTOR'
      ? {
          users_assignment_submissions_student_idTousers: {
            batch_members: { some: { batches: { mentor_id: actor.id } } },
          },
        }
      : {};
  let assignments = await db.assignment_submissions.findMany({
    where: { ...student, ...mentor, assignments: { courses: courseScope(actor) } },
    include: {
      assignments: { select: { title: true, total_marks: true, course_id: true, batch_id: true } },
      users_assignment_submissions_student_idTousers: { select: { id: true, full_name: true } },
    },
    orderBy: { submitted_at: 'desc' },
  });
  if (actor.role === 'MENTOR') {
    const members = await db.batch_members.findMany({
      where: { batches: { mentor_id: actor.id } },
      include: { batches: { select: { course_id: true } } },
    });
    assignments = assignments.filter((s) =>
      members.some(
        (m) =>
          m.student_id === s.student_id &&
          m.batches.course_id === s.assignments.course_id &&
          (!s.assignments.batch_id || s.assignments.batch_id === m.batch_id),
      ),
    );
  }
  return { assignments };
});
