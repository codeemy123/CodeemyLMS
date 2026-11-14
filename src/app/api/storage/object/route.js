import { authorizeObject } from '@/lib/server/storage-access';
import { errorResponse } from '@/lib/server/api';
import { validObjectSignature, r2Request } from '@/lib/server/r2';
import { getPrisma } from '@/lib/prisma';
export const runtime = 'nodejs';
export async function GET(request) {
  try {
    const url = new URL(request.url),
      key = url.searchParams.get('key');
    if (!validObjectSignature(key, url.searchParams.get('signature')))
      return new Response('Invalid file access link.', { status: 403 });
    const actor = await authorizeObject(request, key, request.method === 'DELETE');
    // A class recording is deliberately playback-only for learners.  Its URL is
    // still range-enabled for the video element, but a learner cannot turn that
    // same authenticated URL into a download attachment.
    if (url.searchParams.get('download') === '1' && actor.role === 'STUDENT') {
      const recordingAudit = await getPrisma().audit_logs.findFirst({
        where: {
          action: 'FILE_UPLOADED',
          entity_type: 'zoom_recording',
          details: { path: ['key'], equals: key },
        },
        orderBy: { created_at: 'desc' },
        select: { id: true },
      });
      if (recordingAudit)
        return new Response('Class recordings are available for online viewing only.', {
          status: 403,
        });
    }
    const range = request.headers.get('range');
    if (range && !/^bytes=\d*-\d*$/.test(range))
      return new Response('Invalid range.', { status: 416 });
    const response = await r2Request('GET', key, { headers: range ? { range } : {} });
    if (!response.ok)
      return new Response('File unavailable.', {
        status: response.status === 404 ? 404 : response.status === 416 ? 416 : 502,
      });
    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges'])
      if (response.headers.has(name)) headers.set(name, response.headers.get(name));
    const type = response.headers.get('content-type') || 'application/octet-stream';
    const preview =
      type.startsWith('image/') || type.startsWith('video/') || type === 'application/pdf';
    headers.set(
      'content-disposition',
      `${url.searchParams.get('download') === '1' || !preview ? 'attachment' : 'inline'}; filename="${key.split('/').at(-1)}"`,
    );
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    if (error.status) return errorResponse(error);
    return new Response('Storage temporarily unavailable.', { status: 503 });
  }
}
export async function DELETE(request) {
  try {
    const url = new URL(request.url),
      key = url.searchParams.get('key');
    if (!validObjectSignature(key, url.searchParams.get('signature')))
      return new Response('Invalid file access link.', { status: 403 });
    await authorizeObject(request, key, true);
    const response = await r2Request('DELETE', key);
    return response.ok
      ? new Response(null, { status: 204 })
      : new Response('Could not delete file.', { status: 502 });
  } catch (error) {
    if (error.status) return errorResponse(error);
    return new Response('Storage temporarily unavailable.', { status: 503 });
  }
}
