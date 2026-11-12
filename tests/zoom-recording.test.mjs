import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyZoomSignature, occurrencePath } from '../src/lib/server/zoom.js';
import { multipartTransfer } from '../src/lib/server/recording-transfer.js';
test('Zoom webhook rejects modified payloads and stale signed requests', () => {
  const raw = '{"event":"recording.completed"}',
    secret = 'unit-test-secret',
    now = 1800000000000,
    timestamp = String(now / 1000);
  const signature =
    'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${raw}`).digest('hex');
  assert.equal(verifyZoomSignature(raw, timestamp, signature, secret, now), true);
  assert.equal(verifyZoomSignature(raw + ' ', timestamp, signature, secret, now), false);
  assert.equal(verifyZoomSignature(raw, timestamp, 'v0=' + 'é'.repeat(64), secret, now), false);
  assert.equal(verifyZoomSignature(raw, timestamp, signature, secret, now + 301000), false);
  assert.equal(occurrencePath('/uuid//'), '%252Fuuid%252F%252F');
});
test('large recording transfer uses bounded parts and completes only after all parts', async () => {
  const calls = [],
    sizes = [];
  const request = async (method, key, options) => {
    calls.push(method);
    if (options.query.uploads === '') return new Response('<UploadId>unit-id</UploadId>');
    if (method === 'PUT') {
      sizes.push(options.body.length);
      return new Response('', { headers: { etag: '"part"' } });
    }
    if (method === 'POST') {
      assert.match(options.body, /<PartNumber>2<\/PartNumber>/);
      return new Response('<CompleteMultipartUploadResult/>');
    }
    throw new Error('Unexpected request');
  };
  async function* stream() {
    yield Buffer.alloc(6 * 1024 ** 2);
    yield Buffer.alloc(6 * 1024 ** 2);
  }
  assert.equal(await multipartTransfer('test-key', stream(), { request }), 12 * 1024 ** 2);
  assert.deepEqual(sizes, [8 * 1024 ** 2, 4 * 1024 ** 2]);
  assert.deepEqual(calls, ['POST', 'PUT', 'PUT', 'POST']);
});
test('recording transfer aborts multipart upload on download size overflow', async () => {
  let aborted = false;
  const request = async (method) => {
    if (method === 'DELETE') {
      aborted = true;
      return new Response('');
    }
    return new Response('<UploadId>unit-id</UploadId>');
  };
  async function* stream() {
    yield Buffer.alloc(100);
  }
  await assert.rejects(
    multipartTransfer('test-key', stream(), { request, maxBytes: 50 }),
    /RECORDING_SIZE_LIMIT/,
  );
  assert.equal(aborted, true);
});
