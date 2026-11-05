import { authenticated } from '@/lib/server/auth';
import { requireSession, saveAttendance } from '@/lib/server/data-access';
import { ApiError, jsonBody, roleAllowed, uuid, choice } from '@/lib/server/api';
export const runtime = 'nodejs';
export const GET = authenticated(async (request, _context, actor, db) => {
  const sessionId = uuid(new URL(request.url).searchParams.get('sessionId'));
  const session = await requireSession(db, actor, sessionId);
  const studentIds =
    actor.role === 'STUDENT' ? [actor.id] : session.batches.batch_members.map((m) => m.student_id);
  const [attendance, students] = await Promise.all([
    db.attendance.findMany({ where: { session_id: sessionId, student_id: { in: studentIds } } }),
    db.users.findMany({ where: { id: { in: studentIds } }, select: { id: true, full_name: true } }),
  ]);
  return { attendance, students };
});
export const POST = authenticated(async (request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN', 'MENTOR']);
  const body = await jsonBody(request),
    sessionId = uuid(body.sessionId);
  if (!Array.isArray(body.marks) || body.marks.length > 2000)
    throw new ApiError(400, 'Invalid attendance list.');
  return db.$transaction(
    async (tx) => {
      const marks = body.marks.map((item) => ({
        studentId: uuid(item.studentId),
        status: choice(item.status, ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
      }));
      return { attendance: await saveAttendance(tx, actor, sessionId, marks) };
    },
    { timeout: 30000 },
  );
});
