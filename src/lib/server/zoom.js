import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './api.js';
let cached;
export function verifyZoomSignature(raw, timestamp, signature, secret, now = Date.now()) {
  if (!secret || !/^\d+$/.test(timestamp || '') || Math.abs(now / 1000 - Number(timestamp)) > 300)
    return false;
  const expected =
    'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${raw}`).digest('hex');
  return (
    typeof signature === 'string' &&
    /^v0=[a-f0-9]{64}$/.test(signature) &&
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}
export function zoomChallenge(token, secret) {
  return createHmac('sha256', secret).update(token).digest('hex');
}
export async function zoomToken() {
  if (cached && cached.until > Date.now()) return cached.value;
  const { ZOOM_ACCOUNT_ID: account, ZOOM_CLIENT_ID: id, ZOOM_CLIENT_SECRET: secret } = process.env;
  if (!account || !id || !secret)
    throw new ApiError(503, 'Zoom account integration is not configured.');
  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'account_credentials', account_id: account }),
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok) throw new ApiError(502, 'Zoom authorization failed.');
  const data = await response.json();
  cached = {
    value: data.access_token,
    until: Date.now() + Math.max(0, data.expires_in - 120) * 1000,
  };
  return cached.value;
}
export async function zoomRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch('https://api.zoom.us/v2' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + (await zoomToken()),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // Zoom can return an empty non-JSON response for some API errors.
  }
  if (!response.ok) {
    const detail = typeof data?.message === 'string' ? ` ${data.message}` : '';
    throw new ApiError(502, `Zoom request could not be completed.${detail}`);
  }
  return data;
}
export async function zoomApi(path) {
  return zoomRequest(path);
}
export function occurrencePath(value) {
  // Zoom requires double-encoding UUIDs beginning with / or containing //.
  return value.startsWith('/') || value.includes('//')
    ? encodeURIComponent(encodeURIComponent(value))
    : encodeURIComponent(value);
}
export async function discoverRecordings(db, meetingUuid) {
  const meeting = await zoomApi('/meetings/' + occurrencePath(meetingUuid) + '/recordings');
  if (meeting.uuid !== meetingUuid)
    throw new ApiError(409, 'Use the exact completed meeting occurrence UUID.');
  for (const file of meeting.recording_files || []) {
    if (file.file_type !== 'MP4' || file.status !== 'completed') continue;
    await db.zoom_recordings.upsert({
      where: { file_id: file.id },
      create: { file_id: file.id, meeting_uuid: meetingUuid },
      update: {},
    });
  }
  return meeting;
}
