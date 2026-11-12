import { authenticated } from '@/lib/server/auth';
import { roleAllowed, text, ApiError } from '@/lib/server/api';
import { zoomApi } from '@/lib/server/zoom';
export const GET = authenticated(async (request, _context, actor) => {
  roleAllowed(actor, ['ADMIN', 'MENTOR']);
  const params = new URL(request.url).searchParams;
  const email =
    actor.role === 'ADMIN' && params.get('hostEmail')
      ? text(params.get('hostEmail'), 255)
      : actor.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ApiError(400, 'Enter a valid Zoom host email.');
  const now = new Date(),
    from = new Date(now.getTime() - 29 * 86400000);
  const query = new URLSearchParams({
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
    page_size: '100',
  });
  if (params.get('cursor')) query.set('next_page_token', text(params.get('cursor'), 2000));
  const result = await zoomApi('/users/' + encodeURIComponent(email) + '/recordings?' + query);
  return {
    meetings: (result.meetings || [])
      .filter((m) =>
        m.recording_files?.some((f) => f.file_type === 'MP4' && f.status === 'completed'),
      )
      .map((m) => ({ uuid: m.uuid, title: m.topic, startAt: m.start_time, duration: m.duration })),
    nextCursor: result.next_page_token || null,
  };
});
