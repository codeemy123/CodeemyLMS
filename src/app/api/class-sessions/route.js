import { jsonBody, text, uuid, roleAllowed, ApiError } from '@/lib/server/api';
import { authenticated } from '@/lib/server/auth';
import { sessionScope } from '@/lib/server/data-access';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => ({
  sessions: await db.class_sessions.findMany({
    where: sessionScope(actor),
    orderBy: { start_at: 'desc' },
    include: { batches: { select: { id: true, name: true, course_id: true } } },
  }),
}));

export const POST = authenticated(async (request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const body = await jsonBody(request);
  const batchId = uuid(body.batchId);
  const batch = await db.batches.findUnique({ where: { id: batchId } });
  if (!batch) throw new ApiError(400, 'Select a valid batch.');
  const start = new Date(body.startAt);
  const end = body.endAt ? new Date(body.endAt) : null;
  if (
    !Number.isFinite(start.getTime()) ||
    (end && (!Number.isFinite(end.getTime()) || end <= start))
  )
    throw new ApiError(400, 'Enter valid class start/end times.');
  let meetingUrl = null;
  if (body.meetingUrl) {
    try {
      const url = new URL(body.meetingUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      meetingUrl = url.href;
    } catch {
      throw new ApiError(400, 'Use an HTTPS meeting URL.');
    }
  }
  return db.$transaction(async (tx) => {
    const session = await tx.class_sessions.create({
      data: {
        batch_id: batchId,
        mentor_id: batch.mentor_id,
        title: text(body.title),
        start_at: start,
        end_at: end,
        meeting_url: meetingUrl,
      },
    });
    const members = await tx.batch_members.findMany({ where: { batch_id: batchId } });
    const recipients = [
      ...new Set([
        ...members.map((m) => m.student_id),
        ...(batch.mentor_id ? [batch.mentor_id] : []),
      ]),
    ];
    if (recipients.length)
      await tx.notifications.createMany({
        data: recipients.map((user_id) => ({
          user_id,
          title: 'Class scheduled',
          message: session.title,
          type: 'CLASS',
          reference_id: session.id,
        })),
      });
    return { session };
  });
});
