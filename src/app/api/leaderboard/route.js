import { authenticated } from '@/lib/server/auth';
import { ApiError, uuid } from '@/lib/server/api';
import { requireAssessment } from '@/lib/server/assessment-workflows';
export const GET = authenticated(async (request, _context, actor, db) => {
  const params = new URL(request.url).searchParams;
  const assessment = await requireAssessment(db, actor, uuid(params.get('assessmentId')));
  const batchId = uuid(params.get('batchId'));
  if (assessment.batch_id && assessment.batch_id !== batchId)
    throw new ApiError(404, 'Batch does not match assessment.');
  const batch = await db.batches.findFirst({
    where: {
      id: batchId,
      course_id: assessment.course_id,
      ...(actor.role === 'STUDENT'
        ? { batch_members: { some: { student_id: actor.id } } }
        : actor.role === 'MENTOR'
          ? { mentor_id: actor.id }
          : {}),
    },
  });
  if (!batch) throw new ApiError(404, 'Batch not assigned.');
  const attempts = await db.assessment_attempts.findMany({
    where: {
      assessment_id: assessment.id,
      status: 'EVALUATED',
      users: { batch_members: { some: { batch_id: batch.id } } },
    },
    include: { users: { select: { full_name: true } } },
    orderBy: [{ score: 'desc' }, { submitted_at: 'asc' }],
  });
  const best = new Map();
  for (const a of attempts) if (!best.has(a.student_id)) best.set(a.student_id, a);
  let rank = 0,
    last;
  return {
    batch: batch.name,
    records: [...best.values()].map((a, i) => {
      if (last !== Number(a.score)) rank = i + 1;
      last = Number(a.score);
      return { rank, name: a.users.full_name, score: a.score };
    }),
  };
});
