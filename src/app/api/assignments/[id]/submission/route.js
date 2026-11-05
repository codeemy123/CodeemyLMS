import { authenticated } from '@/lib/server/auth';
import { requireCourse } from '@/lib/server/data-access';
import { jsonBody, roleAllowed, uuid, text, ApiError } from '@/lib/server/api';
import { authorizeObject } from '@/lib/server/storage-access';
export const runtime = 'nodejs';
export const POST = authenticated(async (request, context, actor, db) => {
  roleAllowed(actor, ['STUDENT']);
  const id = uuid((await context.params).id);
  const work = await db.assignments.findUnique({ where: { id } });
  if (!work?.course_id) throw new ApiError(404, 'Assignment not found.');
  await requireCourse(db, actor, work.course_id);
  if (
    work.batch_id &&
    !(await db.batch_members.findUnique({
      where: { batch_id_student_id: { batch_id: work.batch_id, student_id: actor.id } },
    }))
  )
    throw new ApiError(404, 'Assignment not assigned.');
  if (work.due_date && work.due_date < new Date())
    throw new ApiError(403, 'Submission deadline has passed.');
  const body = await jsonBody(request),
    submission = text(body.submissionText || '', 20000, false);
  let file = null;
  if (body.fileUrl) {
    const u = new URL(text(body.fileUrl, 3000), 'http://storage.local');
    if (u.origin !== 'http://storage.local' || u.pathname !== '/api/storage/object')
      throw new ApiError(400, 'Upload a submission file first.');
    await authorizeObject(request, u.searchParams.get('key'), true);
    file = u.pathname + u.search;
  }
  if (!submission && !file) throw new ApiError(400, 'Enter submission text or upload a file.');
  const existing = await db.assignment_submissions.findUnique({
    where: { assignment_id_student_id: { assignment_id: id, student_id: actor.id } },
  });
  if (existing)
    throw new ApiError(
      409,
      'Submission already exists. Revision history support is pending; existing work was preserved.',
    );
  return db.$transaction(async (tx) => {
    const saved = await tx.assignment_submissions.create({
      data: {
        assignment_id: id,
        student_id: actor.id,
        submission_text: submission,
        file_url: file,
      },
    });
    const batch = work.batch_id
      ? await tx.batches.findUnique({ where: { id: work.batch_id } })
      : null;
    const course = await tx.courses.findUnique({ where: { id: work.course_id } });
    const mentorId = batch?.mentor_id || course?.mentor_id;
    if (mentorId)
      await tx.notifications.create({
        data: {
          user_id: mentorId,
          title: 'Assignment submitted',
          message: actor.full_name + ': ' + work.title,
          type: 'SUBMISSION',
          reference_id: saved.id,
        },
      });
    return { submission: saved };
  });
});
