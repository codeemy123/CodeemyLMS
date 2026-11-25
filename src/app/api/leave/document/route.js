import { requireLeaveOrLmsAdmin, requireLeaveActor } from '@/lib/server/leave-auth';
import { validObjectSignature, r2Request } from '@/lib/server/r2';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const signature = url.searchParams.get('signature');
    if (!validObjectSignature(key, signature)) {
      return new Response('Invalid document link.', { status: 403 });
    }
    try {
      await requireLeaveActor(request);
    } catch {
      await requireLeaveOrLmsAdmin(request, ['ADMIN']);
    }
    const response = await r2Request('GET', key);
    if (!response.ok) {
      return new Response('Document unavailable.', {
        status: response.status === 404 ? 404 : 502,
      });
    }
    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    for (const name of ['content-type', 'content-length']) {
      if (response.headers.has(name)) headers.set(name, response.headers.get(name));
    }
    const type = response.headers.get('content-type') || 'application/octet-stream';
    const preview = type.startsWith('image/') || type === 'application/pdf';
    headers.set(
      'content-disposition',
      `${preview ? 'inline' : 'attachment'}; filename="${key.split('/').at(-1)}"`,
    );
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    return new Response(error?.message || 'Unauthorized.', { status: error?.status || 401 });
  }
}
