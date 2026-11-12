import { getPrisma } from '@/lib/prisma';
import { verifyZoomSignature, zoomChallenge } from '@/lib/server/zoom';
export const runtime = 'nodejs';
export async function POST(request) {
  const secret = process.env.ZOOM_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Zoom webhook is not configured.' }, { status: 503 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1048576) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (
    !verifyZoomSignature(
      raw,
      request.headers.get('x-zm-request-timestamp'),
      request.headers.get('x-zm-signature'),
      secret,
    )
  )
    return new Response(null, { status: 401 });
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (data.event === 'endpoint.url_validation') {
    const plainToken = data.payload?.plainToken;
    if (typeof plainToken !== 'string' || plainToken.length > 1000)
      return new Response(null, { status: 400 });
    return Response.json({ plainToken, encryptedToken: zoomChallenge(plainToken, secret) });
  }
  if (data.event !== 'recording.completed') return new Response(null, { status: 204 });
  if (data.payload?.account_id !== process.env.ZOOM_ACCOUNT_ID)
    return new Response(null, { status: 403 });
  const meeting = data.payload?.object;
  if (typeof meeting?.uuid !== 'string') return new Response(null, { status: 400 });
  const db = getPrisma();
  const link = await db.zoom_class_links.findUnique({ where: { meeting_uuid: meeting.uuid } });
  // A mentor can sync an unmapped occurrence later; never guess a batch from its title.
  if (!link) return new Response(null, { status: 204 });
  try {
    await db.$transaction(
      async (tx) => {
        for (const file of meeting.recording_files || [])
          if (
            file.file_type === 'MP4' &&
            file.status === 'completed' &&
            typeof file.id === 'string'
          )
            await tx.zoom_recordings.upsert({
              where: { file_id: file.id },
              create: { file_id: file.id, meeting_uuid: meeting.uuid },
              update: {},
            });
      },
      { timeout: 2000, maxWait: 500 },
    );
  } catch {
    return new Response(null, { status: 503 });
  }
  return new Response(null, { status: 204 });
}
