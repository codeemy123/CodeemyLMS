import { localStorageRequestAllowed } from '@/lib/storage-policy';
import { validObjectSignature, r2Request } from '@/lib/server/r2';
export const runtime = 'nodejs';
export async function GET(request) {
  if (!localStorageRequestAllowed(request, process.env.R2_LOCAL_PREVIEW_ENABLED === 'true'))
    return new Response('Local storage preview only.', { status: 403 });
  try {
    const url = new URL(request.url),
      key = url.searchParams.get('key');
    if (!validObjectSignature(key, url.searchParams.get('signature')))
      return new Response('Invalid file access link.', { status: 403 });
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
  } catch {
    return new Response('Storage temporarily unavailable.', { status: 503 });
  }
}
export async function DELETE(request) {
  if (!localStorageRequestAllowed(request, process.env.R2_LOCAL_PREVIEW_ENABLED === 'true'))
    return new Response('Local storage preview only.', { status: 403 });
  try {
    const url = new URL(request.url),
      key = url.searchParams.get('key');
    if (!validObjectSignature(key, url.searchParams.get('signature')))
      return new Response('Invalid file access link.', { status: 403 });
    const response = await r2Request('DELETE', key);
    return response.ok
      ? new Response(null, { status: 204 })
      : new Response('Could not delete file.', { status: 502 });
  } catch {
    return new Response('Storage temporarily unavailable.', { status: 503 });
  }
}
