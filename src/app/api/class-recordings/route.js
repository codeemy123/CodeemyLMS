import { authenticated } from '@/lib/server/auth';
import { jsonBody, text, uuid, roleAllowed, ApiError } from '@/lib/server/api';
import { requireSession } from '@/lib/server/data-access';
import { discoverRecordings, zoomApi, occurrencePath } from '@/lib/server/zoom';
import { objectUrl } from '@/lib/server/r2';
export const GET = authenticated(async (request, _context, actor, db) => {
  const classId = uuid(new URL(request.url).searchParams.get('classId'));
  await requireSession(db, actor, classId);
  const recordings = await db.zoom_recordings.findMany({
    where: {
      zoom_class_links: { class_id: classId },
      ...(actor.role === 'STUDENT' ? { status: 'READY' } : {}),
    },
    orderBy: { created_at: 'asc' },
  });
  return {
    recordings: recordings.map(({ object_key, size_bytes, ...r }) => ({
      ...r,
      size: size_bytes?.toString(),
      url: r.status === 'READY' && object_key ? objectUrl(object_key) : null,
    })),
  };
});
export const POST = authenticated(async (request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN', 'MENTOR']);
  const body = await jsonBody(request);
  const session = await requireSession(db, actor, uuid(body.classId));
  if (body.action === 'sync') {
    const meetingUuid = text(body.meetingUuid, 255);
    const meeting = await zoomApi('/meetings/' + occurrencePath(meetingUuid) + '/recordings');
    if (meeting.uuid !== meetingUuid)
      throw new ApiError(409, 'Use the exact completed meeting occurrence UUID.');
    if (actor.role === 'MENTOR') {
      const host = await zoomApi('/users/' + encodeURIComponent(meeting.host_id));
      if (host.email?.toLowerCase() !== actor.email.toLowerCase())
        throw new ApiError(403, 'Only your own Zoom recording can be linked.');
    }
    const previous = await db.zoom_class_links.findUnique({ where: { meeting_uuid: meetingUuid } });
    if (previous && previous.class_id !== session.id)
      throw new ApiError(409, 'This occurrence is already linked to another class.');
    await db.zoom_class_links.upsert({
      where: { meeting_uuid: meetingUuid },
      create: { meeting_uuid: meetingUuid, class_id: session.id },
      update: {},
    });
    await discoverRecordings(db, meetingUuid);
    return { synced: true };
  }
  if (body.action !== 'publish') throw new ApiError(400, 'Invalid recording action.');
  const changed = await db.zoom_recordings.updateMany({
    where: {
      id: uuid(body.id),
      zoom_class_links: { class_id: session.id },
      status: { in: ['WAITING_PUBLISH', 'FAILED'] },
      attempts: { lt: 5 },
    },
    data: { status: 'QUEUED', updated_at: new Date() },
  });
  if (!changed.count) throw new ApiError(409, 'Recording is unavailable or already queued.');
  return { queued: true };
});
