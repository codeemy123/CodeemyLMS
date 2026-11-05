import { authenticated } from '@/lib/server/auth';
import { jsonBody, text, uuid, roleAllowed, ApiError } from '@/lib/server/api';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => ({
  batches: await db.batches.findMany({
    where:
      actor.role === 'ADMIN'
        ? {}
        : actor.role === 'MENTOR'
          ? { mentor_id: actor.id }
          : { batch_members: { some: { student_id: actor.id } } },
    include: {
      courses: { select: { id: true, title: true } },
      users: { select: { id: true, full_name: true } },
      batch_members: {
        where: actor.role === 'STUDENT' ? { student_id: actor.id } : {},
        include: { users: { select: { id: true, full_name: true } } },
      },
    },
    orderBy: { name: 'asc' },
  }),
}));
export const POST = authenticated(async (request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const body = await jsonBody(request);
  const courseId = uuid(body.courseId),
    mentorId = uuid(body.mentorId);
  if (
    !(await db.courses.findUnique({ where: { id: courseId } })) ||
    !(await db.users.findFirst({ where: { id: mentorId, role: 'MENTOR', status: 'ACTIVE' } }))
  )
    throw new ApiError(400, 'Select a valid course and active mentor.');
  if (!Array.isArray(body.studentIds) || body.studentIds.length > 2000)
    throw new ApiError(400, 'Select students.');
  const studentIds = [...new Set(body.studentIds.map(uuid))];
  if (
    (await db.users.count({
      where: { id: { in: studentIds }, role: 'STUDENT', status: 'ACTIVE' },
    })) !== studentIds.length
  )
    throw new ApiError(400, 'Select active students.');
  return {
    batch: await db.batches.create({
      data: {
        name: text(body.name, 150),
        course_id: courseId,
        mentor_id: mentorId,
        batch_members: { create: studentIds.map((student_id) => ({ student_id })) },
      },
    }),
  };
});
