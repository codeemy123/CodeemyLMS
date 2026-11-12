import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { r2Request } from '../src/lib/server/r2.js';
import { multipartTransfer } from '../src/lib/server/recording-transfer.js';
config({ path: ['.env.local', '.env'], quiet: true });
const key = 'codeemy/uploads/' + randomUUID() + '/multipart-test.mp4';
try {
  async function* stream() {
    yield Buffer.alloc(6 * 1024 ** 2, 65);
    yield Buffer.alloc(3 * 1024 ** 2, 66);
  }
  assert.equal(await multipartTransfer(key, stream()), 9 * 1024 ** 2);
  const head = await r2Request('HEAD', key);
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), 9 * 1024 ** 2);
  const range = await r2Request('GET', key, { headers: { range: 'bytes=6291456-6291458' } });
  assert.equal(range.status, 206);
  assert.equal(await range.text(), 'BBB');
  console.log('PASS real R2 multipart completion, object length and ranged video reads');
} finally {
  const removed = await r2Request('DELETE', key);
  assert.ok(removed.ok);
  console.log('Temporary R2 multipart test object removed.');
}
