// Server/Node-only module. Credentials never enter client components or API responses.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
let clockOffset = 0;
function config() {
  const env = process.env;
  const endpoint = new URL(env.CLOUDFLARE_R2_ENDPOINT || 'https://invalid.invalid');
  if (
    endpoint.protocol !== 'https:' ||
    !endpoint.hostname.endsWith('.r2.cloudflarestorage.com') ||
    !['', '/'].includes(endpoint.pathname) ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.username ||
    endpoint.password
  )
    throw new Error('R2 endpoint is not configured correctly.');
  const bucket = env.CLOUDFLARE_R2_BUCKET_NAME;
  if (
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket || '') ||
    !/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_R2_ACCESS_KEY_ID || '') ||
    !/^[a-f0-9]{64}$/i.test(env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '')
  )
    throw new Error('R2 S3 credentials are not configured correctly.');
  return {
    endpoint,
    bucket,
    id: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secret: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  };
}
export function validObjectKey(key) {
  return /^codeemy\/uploads\/[0-9a-f-]{36}\/[a-zA-Z0-9_.-]{1,100}$/.test(key || '');
}
export function objectSignature(key) {
  if (!validObjectKey(key)) throw new Error('Invalid storage object.');
  return createHmac('sha256', config().secret)
    .update('codeemy-local-read:' + key)
    .digest('hex');
}
export function validObjectSignature(key, signature) {
  if (!validObjectKey(key) || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  return timingSafeEqual(Buffer.from(objectSignature(key), 'hex'), Buffer.from(signature, 'hex'));
}
export function objectUrl(key) {
  return (
    '/api/storage/object?key=' + encodeURIComponent(key) + '&signature=' + objectSignature(key)
  );
}
export async function r2Request(method, key, { body, headers = {}, query = {} } = {}) {
  if (!validObjectKey(key)) throw new Error('Invalid storage object.');
  const { endpoint, bucket, id, secret } = config();
  async function send() {
    const timestamp = new Date(Date.now() + clockOffset).toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8),
      scope = date + '/auto/s3/aws4_request',
      payload = hash(body || '');
    const path = '/' + bucket + '/' + key.split('/').map(encodeURIComponent).join('/');
    const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    const canonicalQuery = Object.entries(query).map(([k,v]) => [encode(k),encode(String(v))]).sort((a,b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1).map(([k,v]) => k + '=' + v).join('&');
    const values = {
      ...headers,
      host: endpoint.host,
      'x-amz-date': timestamp,
      'x-amz-content-sha256': payload,
    };
    const names = Object.keys(values).sort();
    const canonical = names.map((name) => name + ':' + String(values[name]).trim() + '\n').join('');
    const request = [method, path, canonicalQuery, canonical, names.join(';'), payload].join('\n');
    const signing = hmac(hmac(hmac(hmac('AWS4' + secret, date), 'auto'), 's3'), 'aws4_request');
    const signature = createHmac('sha256', signing)
      .update('AWS4-HMAC-SHA256\n' + timestamp + '\n' + scope + '\n' + hash(request))
      .digest('hex');
    delete values.host;
    return fetch(endpoint.origin + path + (canonicalQuery ? '?' + canonicalQuery : ''), {
      method,
      body,
      headers: {
        ...values,
        Authorization: `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(120000),
    });
  }
  let response = await send();
  if (response.status === 403) {
    const text = await response.clone().text();
    if (text.includes('<Code>RequestTimeTooSkewed</Code>')) {
      const serverTime = new Date(
        text.match(/<ServerTime>([^<]+)<\/ServerTime>/)?.[1] || response.headers.get('date'),
      ).getTime();
      if (Number.isFinite(serverTime)) {
        clockOffset = serverTime - Date.now();
        await response.body?.cancel();
        response = await send();
      }
    }
  }
  return response;
}
