import { randomUUID } from 'node:crypto';
import { r2Request } from './r2.js';
import { zoomApi, zoomToken, occurrencePath } from './zoom.js';

export async function multipartTransfer(
  key,
  stream,
  { request = r2Request, maxBytes = 20 * 1024 ** 3, heartbeat = async () => {} } = {},
) {
  const begin = await request('POST', key, {
    query: { uploads: '' },
    headers: { 'content-type': 'video/mp4' },
  });
  if (!begin.ok) throw new Error('MULTIPART_START_FAILED');
  const uploadId = (await begin.text()).match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!uploadId) throw new Error('MULTIPART_ID_MISSING');
  const parts = [];
  let pending = Buffer.alloc(0),
    total = 0;
  async function part(buffer) {
    const response = await request('PUT', key, {
      query: { uploadId, partNumber: parts.length + 1 },
      body: buffer,
    });
    const tag = response.headers.get('etag');
    if (!response.ok || !tag) throw new Error('MULTIPART_PART_FAILED');
    parts.push(tag);
    await heartbeat();
  }
  try {
    for await (const chunk of stream) {
      total += chunk.length;
      if (total > maxBytes) throw new Error('RECORDING_SIZE_LIMIT');
      pending = Buffer.concat([pending, Buffer.from(chunk)]);
      while (pending.length >= 8 * 1024 ** 2) {
        await part(pending.subarray(0, 8 * 1024 ** 2));
        pending = pending.subarray(8 * 1024 ** 2);
      }
    }
    if (pending.length) await part(pending);
    if (!parts.length) throw new Error('EMPTY_RECORDING');
    const escape = (v) =>
      v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const xml =
      '<CompleteMultipartUpload>' +
      parts
        .map(
          (tag, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${escape(tag)}</ETag></Part>`,
        )
        .join('') +
      '</CompleteMultipartUpload>';
    const finish = await request('POST', key, {
      query: { uploadId },
      body: xml,
      headers: { 'content-type': 'application/xml' },
    });
    if (!finish.ok || (await finish.text()).includes('<Error>'))
      throw new Error('MULTIPART_COMPLETE_FAILED');
    return total;
  } catch (error) {
    await request('DELETE', key, { query: { uploadId } }).catch(() => {});
    throw error;
  }
}
export async function transferNextRecording(db) {
  await db.zoom_recordings.updateMany({
    where: { status: 'PROCESSING', attempts: { gte: 5 }, lease_until: { lt: new Date() } },
    data: {
      status: 'FAILED',
      lease_until: null,
      last_error: 'RETRY_LIMIT_REACHED',
      updated_at: new Date(),
    },
  });
  const rows =
    await db.$queryRaw`UPDATE zoom_recordings SET status='PROCESSING', attempts=attempts+1, lease_until=now()+interval '10 minutes', updated_at=now() WHERE id=(SELECT id FROM zoom_recordings WHERE (status='QUEUED' OR (status='PROCESSING' AND lease_until < now())) AND attempts < 5 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`;
  if (!rows.length) return false;
  const id = rows[0].id;
  const job = await db.zoom_recordings.findUnique({
    where: { id },
    include: { zoom_class_links: { include: { class_sessions: true } } },
  });
  const key = 'codeemy/uploads/' + randomUUID() + '/class-recording.mp4';
  try {
    const meeting = await zoomApi('/meetings/' + occurrencePath(job.meeting_uuid) + '/recordings');
    const file = meeting.recording_files?.find(
      (f) => f.id === job.file_id && f.file_type === 'MP4' && f.status === 'completed',
    );
    if (!file) throw new Error('ZOOM_FILE_NOT_READY');
    const url = new URL(file.download_url);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !url.hostname.endsWith('.zoom.us') ||
      (url.port && url.port !== '443')
    )
      throw new Error('UNTRUSTED_DOWNLOAD_HOST');
    const response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + (await zoomToken()) },
      redirect: 'error',
      signal: AbortSignal.timeout(60 * 60 * 1000),
    });
    if (!response.ok || !response.body) throw new Error('ZOOM_DOWNLOAD_FAILED');
    const leaseAttempt = job.attempts;
    const size = await multipartTransfer(key, response.body, {
      heartbeat: async () => {
        const lease = await db.zoom_recordings.updateMany({
          where: { id, status: 'PROCESSING', attempts: leaseAttempt },
          data: { lease_until: new Date(Date.now() + 600000) },
        });
        if (!lease.count) throw new Error('LEASE_LOST');
      },
    });
    await db.$transaction(async (tx) => {
      const claimed = await tx.zoom_recordings.updateMany({
        where: { id, status: 'PROCESSING', attempts: leaseAttempt },
        data: {
          status: 'READY',
          object_key: key,
          size_bytes: BigInt(size),
          lease_until: null,
          last_error: null,
          updated_at: new Date(),
        },
      });
      if (!claimed.count) throw new Error('LEASE_LOST');
      await tx.audit_logs.create({
        data: {
          action: 'FILE_UPLOADED',
          entity_type: 'zoom_recording',
          entity_id: id,
          details: {
            key,
            type: 'video/mp4',
            size,
            classId: job.zoom_class_links.class_id,
            batchId: job.zoom_class_links.class_sessions.batch_id,
          },
        },
      });
      const members = await tx.batch_members.findMany({
        where: { batch_id: job.zoom_class_links.class_sessions.batch_id },
        select: { student_id: true },
      });
      await tx.notifications.createMany({
        data: members.map((m) => ({
          user_id: m.student_id,
          title: 'Class recording ready',
          message: job.zoom_class_links.class_sessions.title,
          type: 'CLASS_RECORDING',
          reference_id: job.zoom_class_links.class_id,
        })),
      });
    });
    console.log('Recording transfer ready:', id);
  } catch (error) {
    await r2Request('DELETE', key).catch(() => {});
    const code = /^[A-Z_]+$/.test(error.message) ? error.message : 'TRANSFER_FAILED';
    await db.zoom_recordings.updateMany({
      where: { id, status: 'PROCESSING', attempts: job.attempts },
      data: { status: 'FAILED', last_error: code, lease_until: null, updated_at: new Date() },
    });
    console.error('Recording transfer failed:', id, code);
  }
  return true;
}
