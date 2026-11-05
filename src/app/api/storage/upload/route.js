import { uploadActor } from '@/lib/server/storage-access';
import { getPrisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/server/api';
import { randomUUID } from 'node:crypto';
import { uploadPolicy, VIDEO_LIMIT } from '@/lib/storage-policy';
import { objectUrl, r2Request } from '@/lib/server/r2';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const { actor, courseId } = await uploadActor(request);
    let name;
    try {
      name = decodeURIComponent(request.headers.get('x-file-name') || '');
    } catch {
      return Response.json({ error: 'Invalid file name.' }, { status: 400 });
    }
    const size = Number(request.headers.get('content-length'));
    const policy = uploadPolicy(name, size);
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: 'Choose a file.' }, { status: 400 });
    const chunks = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > policy.limit || length > VIDEO_LIMIT) {
        await reader.cancel();
        return Response.json({ error: 'File exceeds upload limit.' }, { status: 413 });
      }
      chunks.push(value);
    }
    if (length !== size)
      return Response.json({ error: 'Incomplete upload. Please retry.' }, { status: 400 });
    const safeName =
      name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-100) || 'file.' + policy.extension;
    const key = `codeemy/uploads/${randomUUID()}/${safeName}`;
    const response = await r2Request('PUT', key, {
      body: Buffer.concat(chunks),
      headers: { 'content-type': policy.type },
    });
    if (!response.ok)
      return Response.json(
        { error: 'Cloudflare upload failed. Check the server R2 configuration and retry.' },
        { status: 502 },
      );
    try {
      await getPrisma().audit_logs.create({
        data: {
          user_id: actor.id,
          action: 'FILE_UPLOADED',
          entity_type: 'storage',
          details: { key, courseId, name, type: policy.type, size: length },
        },
      });
    } catch (error) {
      await r2Request('DELETE', key).catch(() => {});
      throw error;
    }
    const data = objectUrl(key);
    return Response.json(
      {
        storage: 'r2',
        key,
        name,
        type: policy.type,
        size: length,
        data,
        download: data + '&download=1',
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error.status) return errorResponse(error);
    const message = String(error.message || '');
    const validation = message.startsWith('Use ') || message.startsWith('Choose ');
    return Response.json(
      {
        error: validation ? message : 'Upload unavailable. Check R2 credentials/network and retry.',
      },
      { status: validation ? 400 : 503 },
    );
  }
}
