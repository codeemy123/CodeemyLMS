export const FILE_LIMIT = 20 * 1024 * 1024;
export const VIDEO_LIMIT = 100 * 1024 * 1024;
const types = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export function uploadPolicy(name, size) {
  const extension = String(name).split('.').at(-1).toLowerCase();
  const type = types[extension];
  if (!type)
    throw new Error('Use PNG/JPG/WebP/GIF, MP4/WebM/MOV, PDF, Office, TXT/CSV or ZIP files.');
  const limit = type.startsWith('video/') ? VIDEO_LIMIT : FILE_LIMIT;
  if (!Number.isSafeInteger(size) || size <= 0 || size > limit)
    throw new Error(`Choose a file up to ${limit / 1024 / 1024} MB.`);
  return { type, limit, extension };
}
export function localStorageRequestAllowed(request, enabled) {
  if (!enabled) return false;
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return false;
  let browserUrl;
  try {
    browserUrl = new URL(url.protocol + '//' + (request.headers.get('host') || url.host));
  } catch {
    return false;
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(browserUrl.hostname)) return false;
  const origin = request.headers.get('origin');
  if (origin && origin !== browserUrl.origin) return false;
  const site = request.headers.get('sec-fetch-site');
  if (site && !['same-origin', 'none'].includes(site)) return false;
  return (
    !['POST', 'DELETE'].includes(request.method) || request.headers.get('x-codeemy-upload') === '1'
  );
}
