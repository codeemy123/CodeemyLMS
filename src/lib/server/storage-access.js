import { objectUrl } from './r2.js';
import { requireActor } from './auth.js';
import { assertOrigin, ApiError, uuid } from './api.js';
import { getPrisma } from '@/lib/prisma';
import { requireCourse, requireSession } from './data-access.js';
import { announcementScope } from './announcement-access.js';
import { announcementContent } from '../announcement-content.js';
export async function uploadActor(request) {
  assertOrigin(request);
  const actor = await requireActor(request);
  const courseId = request.headers.get('x-course-id');
  if (courseId) {
    if (actor.role === 'STUDENT')
      throw new ApiError(403, 'Only assigned educators can publish course files.');
    await requireCourse(getPrisma(), actor, uuid(courseId));
  }
  return { actor, courseId };
}
export async function authorizeObject(request, key, write = false) {
  if (write) assertOrigin(request);
  const actor = await requireActor(request);
  const db = getPrisma();
  const record = await db.audit_logs.findFirst({
    where: { action: 'FILE_UPLOADED', details: { path: ['key'], equals: key } },
    orderBy: { created_at: 'desc' },
  });
  if (!record) throw new ApiError(404, 'File is not registered.');
  if (actor.id === record.user_id || actor.role === 'ADMIN') return actor;
  if (!write) {
    const announcements = await db.announcements.findMany({
      where: {
        AND: [await announcementScope(db, actor), { message: { contains: objectUrl(key) } }],
      },
      select: { message: true },
    });
    if (announcements.some((a) => announcementContent(a.message).image_url === objectUrl(key)))
      return actor;
  }
  if (!write && record.details?.classId && record.entity_type === 'zoom_recording') {
    await requireSession(db, actor, record.details.classId);
    const recording = await db.zoom_recordings.findFirst({
      where: { id: record.entity_id, status: 'READY', object_key: key },
    });
    if (!recording) throw new ApiError(404, 'Recording not available.');
    return actor;
  }
  if (!write && actor.role === 'STUDENT') {
    const certificate = await db.certificates.findFirst({
      where: { student_id: actor.id, certificate_url: objectUrl(key) },
    });
    if (certificate) {
      const event = await db.audit_logs.findFirst({
        where: { entity_type: 'certificate_history', entity_id: certificate.id },
        orderBy: { created_at: 'desc' },
      });
      if (event?.action === 'CERTIFICATE_REVOKED') throw new ApiError(410, 'Certificate revoked.');
      return actor;
    }
  }
  if (!write && record.details?.courseId) {
    await requireCourse(db, actor, record.details.courseId);
    return actor;
  }
  if (!write && actor.role === 'MENTOR') {
    const submission = await db.assignment_submissions.findFirst({
      where: { file_url: objectUrl(key) },
      include: { assignments: true },
    });
    if (submission?.assignments.course_id) {
      const work = submission.assignments;
      const membership = await db.batch_members.findFirst({
        where: {
          student_id: submission.student_id,
          batches: {
            mentor_id: actor.id,
            course_id: work.course_id,
            ...(work.batch_id ? { id: work.batch_id } : {}),
          },
        },
      });
      if (membership) return actor;
    }
  }
  throw new ApiError(403, 'You do not have access to this file.');
}
