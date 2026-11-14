import { jsonBody, text, uuid, roleAllowed, ApiError } from '@/lib/server/api';
import { authenticated } from '@/lib/server/auth';
import { sessionScope } from '@/lib/server/data-access';
import { zoomRequest } from '@/lib/server/zoom';
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
  const batch = await db.batches.findUnique({
    where: { id: batchId },
    include: { users: { select: { email: true, full_name: true } } },
  });
  if (!batch) throw new ApiError(400, 'Select a valid batch.');
  const start = new Date(body.startAt);
  const requestedEnd = body.endAt ? new Date(body.endAt) : null;
  const durationMinutes = requestedEnd && Number.isFinite(start.getTime()) && Number.isFinite(requestedEnd.getTime())
    ? Math.round((requestedEnd.getTime() - start.getTime()) / 60_000)
    : Number(body.durationMinutes || 60);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480)
    throw new ApiError(400, 'Class duration must be between 15 minutes and 8 hours.');
  const end = requestedEnd
    ? requestedEnd
    : Number.isFinite(start.getTime())
      ? new Date(start.getTime() + durationMinutes * 60_000)
      : null;
  if (
    !Number.isFinite(start.getTime()) ||
    (end && (!Number.isFinite(end.getTime()) || end <= start))
  )
    throw new ApiError(400, 'Enter valid class start/end times.');
  const description = String(body.description || '').trim() || null;
  if (description && description.length > 2000) throw new ApiError(400, 'Class details are too long.');
  const thumbnailUrl = String(body.thumbnailUrl || '').trim() || null;
  if (thumbnailUrl) {
    try {
      const thumbnail = new URL(thumbnailUrl, request.url);
      const isSecureExternalImage = thumbnail.protocol === 'https:' && thumbnail.origin !== new URL(request.url).origin;
      const isSignedStorageImage =
        thumbnail.origin === new URL(request.url).origin &&
        thumbnail.pathname === '/api/storage/object' &&
        thumbnail.searchParams.has('key') &&
        thumbnail.searchParams.has('signature');
      if (!isSecureExternalImage && !isSignedStorageImage) throw new Error();
    } catch {
      throw new ApiError(400, 'Use a secure class cover image URL.');
    }
  }
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12).map((tag) => tag.slice(0, 40)))]
    : [];
  let meetingUrl = null;
  let meetingUuid = null;
  const createZoom = body.createZoom === true || body.createZoom === 'true' || body.createZoom === 'on';
  if (createZoom) {
    const hostEmail = String(body.hostEmail || batch.users?.email || '')
      .trim()
      .toLowerCase();
    if (!hostEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hostEmail))
      throw new ApiError(
        400,
        'Enter a licensed Zoom host email, or assign a mentor with an academy email to this batch.',
      );
    const meeting = await zoomRequest(`/users/${encodeURIComponent(hostEmail)}/meetings`, {
      method: 'POST',
      body: {
        topic: text(body.title, 255),
        agenda: description || undefined,
        type: 2,
        start_time: start.toISOString(),
        duration: durationMinutes,
        timezone: 'Asia/Kolkata',
        settings: {
          auto_recording: 'cloud',
          waiting_room: true,
          join_before_host: false,
          mute_upon_entry: true,
          host_video: true,
          participant_video: false,
        },
      },
    });
    if (typeof meeting?.join_url !== 'string' || typeof meeting?.uuid !== 'string')
      throw new ApiError(502, 'Zoom did not return a meeting link. Please try again.');
    meetingUrl = meeting.join_url;
    meetingUuid = meeting.uuid;
  } else if (body.meetingUrl) {
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
        description,
        thumbnail_url: thumbnailUrl,
        tags,
        start_at: start,
        end_at: end,
        meeting_url: meetingUrl,
      },
    });
    if (meetingUuid)
      await tx.zoom_class_links.create({
        data: { meeting_uuid: meetingUuid, class_id: session.id },
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
    return { session, zoomMeeting: Boolean(meetingUuid) };
  });
});
