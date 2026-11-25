import { randomUUID } from 'node:crypto';
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { assertOrigin } from '@/lib/server/api';
import { uploadPolicy, FILE_LIMIT } from '@/lib/storage-policy';
import { objectSignature, r2Request } from '@/lib/server/r2';
export const runtime = 'nodejs';

export const POST = leaveAuthenticated(async (request) => {
  assertOrigin(request);
  let name;
  try {
    name = decodeURIComponent(request.headers.get('x-file-name') || '');
  } catch {
    return Response.json({ error: 'Invalid file name.' }, { status: 400 });
  }
  const size = Number(request.headers.get('content-length'));
  const policy = uploadPolicy(name, size);
  if (!policy.type.startsWith('image/') && policy.type !== 'application/pdf') {
    return Response.json(
      { error: 'Upload an image (PNG, JPG, WebP) or PDF document.' },
      { status: 400 },
    );
  }
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: 'Choose a file.' }, { status: 400 });
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > FILE_LIMIT) {
      await reader.cancel();
      return Response.json({ error: 'File exceeds 20 MB limit.' }, { status: 413 });
    }
    chunks.push(value);
  }
  if (length !== size) {
    return Response.json({ error: 'Incomplete upload. Please retry.' }, { status: 400 });
  }
  const safeName =
    name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-100) || 'doc.' + policy.extension;
  const key = `codeemy/uploads/${randomUUID()}/${safeName}`;
  const response = await r2Request('PUT', key, {
    body: Buffer.concat(chunks),
    headers: { 'content-type': policy.type },
  });
  if (!response.ok) {
    return Response.json(
      { error: 'Cloudflare upload failed. Check server R2 configuration.' },
      { status: 502 },
    );
  }
  const url =
    '/api/leave/document?key=' +
    encodeURIComponent(key) +
    '&signature=' +
    objectSignature(key);
  return Response.json(
    { url, key, name: safeName, type: policy.type, size: length },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
});
