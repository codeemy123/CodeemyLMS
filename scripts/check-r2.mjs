// Read-only connection check. Never prints credentials, object names or response bodies.
import { createHash, createHmac } from 'node:crypto';
process.loadEnvFile('.env.local');
const env = process.env;
const required = [
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_BUCKET_NAME',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_ENDPOINT',
];
for (const name of required) {
  if (!env[name]?.trim()) {
    console.log('R2_CONFIGURATION_MISSING: ' + name);
    process.exit(1);
  }
}
for (const [name, length] of [
  ['CLOUDFLARE_R2_ACCOUNT_ID', 32],
  ['CLOUDFLARE_R2_ACCESS_KEY_ID', 32],
  ['CLOUDFLARE_R2_SECRET_ACCESS_KEY', 64],
]) {
  if (!new RegExp('^[a-f0-9]{' + length + '}$', 'i').test(env[name])) {
    console.log(
      'R2_CONFIGURATION_INVALID: ' +
        name +
        ' must contain exactly ' +
        length +
        ' hexadecimal characters. Copy the complete original S3 credential; do not truncate or guess it.',
    );
    console.log('R2_AUTHENTICATION: NOT_TESTED_INVALID_CONFIGURATION');
    process.exit(1);
  }
}
const endpoint = new URL(env.CLOUDFLARE_R2_ENDPOINT);
if (
  endpoint.protocol !== 'https:' ||
  !endpoint.hostname.endsWith('.r2.cloudflarestorage.com') ||
  !['', '/'].includes(endpoint.pathname)
)
  throw new Error('Invalid R2 endpoint');
const bucket = env.CLOUDFLARE_R2_BUCKET_NAME;
if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Invalid bucket name');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
async function check(time) {
  const timestamp = time.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = timestamp.slice(0, 8),
    scope = date + '/auto/s3/aws4_request',
    payload = hash('');
  const path = '/' + bucket,
    query = 'list-type=2&max-keys=1';
  const headers =
    'host:' +
    endpoint.host +
    '\nx-amz-content-sha256:' +
    payload +
    '\nx-amz-date:' +
    timestamp +
    '\n';
  const signed = 'host;x-amz-content-sha256;x-amz-date';
  const canonical = ['GET', path, query, headers, signed, payload].join('\n');
  const key = hmac(
    hmac(hmac(hmac('AWS4' + env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, date), 'auto'), 's3'),
    'aws4_request',
  );
  const signature = createHmac('sha256', key)
    .update('AWS4-HMAC-SHA256\n' + timestamp + '\n' + scope + '\n' + hash(canonical))
    .digest('hex');
  const response = await fetch(endpoint.origin + path + '?' + query, {
    method: 'GET',
    headers: {
      'x-amz-date': timestamp,
      'x-amz-content-sha256': payload,
      Authorization:
        'AWS4-HMAC-SHA256 Credential=' +
        env.CLOUDFLARE_R2_ACCESS_KEY_ID +
        '/' +
        scope +
        ', SignedHeaders=' +
        signed +
        ', Signature=' +
        signature,
    },
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  });
  const body = response.ok ? '' : await response.text();
  return {
    response,
    code: body.match(/<Code>([A-Za-z0-9]+)<\/Code>/)?.[1],
    serverTime:
      body.match(/<ServerTime>([^<]+)<\/ServerTime>/)?.[1] || response.headers.get('date'),
  };
}
try {
  let result = await check(new Date());
  if (result.code === 'RequestTimeTooSkewed') {
    console.log('LOCAL_CLOCK_SKEW: DETECTED');
    const time = new Date(result.serverTime);
    if (Number.isFinite(time.getTime())) {
      console.log('RETRY_USING_R2_SERVER_TIME');
      result = await check(time);
    }
  }
  const { response, code } = result;
  console.log('R2_HTTP_STATUS: ' + response.status);
  if (response.ok) {
    console.log('R2_CREDENTIALS_AND_BUCKET_LIST: VERIFIED');
    console.log('UPLOAD_DELETE: NOT_TESTED_READ_ONLY_CHECK');
  } else {
    console.log('R2_ERROR_CODE: ' + (code || 'UNKNOWN'));
    process.exitCode = 1;
  }
} catch (error) {
  console.log('R2_CONNECTION_FAILED: ' + (error.cause?.code || error.code || error.name));
  process.exitCode = 1;
}
