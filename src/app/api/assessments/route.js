import { authenticated } from '@/lib/server/auth';
import { courseScope } from '@/lib/server/data-access';
export const GET = authenticated(async (_request, _context, actor, db) => {
  const courses = await db.courses.findMany({ where: courseScope(actor), select: { id: true } });
  const assessments = await db.assessments.findMany({
    where: {
      course_id: { in: courses.map((c) => c.id) },
      ...(actor.role === 'STUDENT'
        ? {
            status: 'PUBLISHED',
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
      batches: { select: { name: true } },
      assessment_attempts: {
        where:
          actor.role === 'STUDENT'
            ? { student_id: actor.id }
            : actor.role === 'MENTOR'
              ? { users: { batch_members: { some: { batches: { mentor_id: actor.id } } } } }
              : {},
        select: { id: true, student_id: true, score: true, status: true, submitted_at: true },
        orderBy: [{ started_at: 'desc' }, { created_at: 'desc' }],
        ...(actor.role === 'STUDENT' ? { take: 1 } : {}),
      },
    },
    orderBy: { created_at: 'desc' },
  });
  // Apply the exact course/batch roster to educator attempt summaries.
  if (actor.role === 'MENTOR')
    for (const assessment of assessments) {
      const roster = await db.batch_members.findMany({
        where: {
          batches: {
            mentor_id: actor.id,
            course_id: assessment.course_id,
            ...(assessment.batch_id ? { id: assessment.batch_id } : {}),
          },
        },
        select: { student_id: true },
      });
      const allowed = new Set(roster.map((m) => m.student_id));
      assessment.assessment_attempts = assessment.assessment_attempts.filter((a) =>
        allowed.has(a.student_id),
      );
    }
  return { assessments };
});
