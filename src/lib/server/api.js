export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function assertOrigin(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') || new URL(request.url).host;
  try {
    if (!origin) throw new Error();
    const source = new URL(origin);
    const backendHost = 'codeemy-lms-796236466632.asia-south1.run.app';
    const publicOrigins = ['https://lerno.codeemy.in', 'https://learnoin.netlify.app'];
    const trustedProxyOrigin = host === backendHost && publicOrigins.includes(origin);
    if (source.host !== host && !trustedProxyOrigin) throw new Error();
  } catch {
    throw new ApiError(403, 'A same-origin request is required.');
  }
}
export async function jsonBody(request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(415, 'Send JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Missing request body.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1048576) {
      await reader.cancel();
      throw new ApiError(413, 'Request exceeds 1 MB.');
    }
    chunks.push(value);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data;
  } catch {
    throw new ApiError(400, 'Invalid JSON object.');
  }
}
export function uuid(value) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    throw new ApiError(400, 'Invalid record ID.');
  return value;
}
export function text(value, max = 255, required = true) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    throw new ApiError(400, 'Invalid text field.');
  return value.trim();
}
export function choice(value, values) {
  if (!values.includes(value)) throw new ApiError(400, 'Invalid selection.');
  return value;
}
export function roleAllowed(actor, roles) {
  if (!roles.includes(actor.role))
    throw new ApiError(403, 'This action is not allowed for your role.');
}
export function numeric(value, min = 0, max = 100) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new ApiError(400, 'Invalid numeric value.');
  return value;
}
export function errorResponse(error) {
  let status = error.status || 500,
    message = error.status ? error.message : 'The request could not be completed.';
  if (error.code === 'P2002') {
    status = 409;
    message = 'A matching record already exists.';
  }
  if (error.code === 'P2025') {
    status = 404;
    message = 'Record not found.';
  }
  if (error.message === 'DATABASE_NOT_CONFIGURED') {
    status = 503;
    message = 'Database configuration is required.';
  }
  if (!error.status) console.error('API request failed:', error.code || error.name);
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}
