import test from 'node:test';
import assert from 'node:assert/strict';
import {
  uploadPolicy,
  localStorageRequestAllowed,
  FILE_LIMIT,
  VIDEO_LIMIT,
} from '../src/lib/storage-policy.js';
import { validObjectKey, validObjectSignature, objectSignature } from '../src/lib/server/r2.js';
test('upload limits distinguish videos and documents and reject executable formats', () => {
  assert.equal(uploadPolicy('image.PNG', 100).type, 'image/png');
  assert.equal(uploadPolicy('lesson.webm', VIDEO_LIMIT).type, 'video/webm');
  assert.equal(uploadPolicy('file.zip', FILE_LIMIT).type, 'application/zip');
  for (const [name, size] of [
    ['x.txt', 0],
    ['x.txt', FILE_LIMIT + 1],
    ['x.mp4', VIDEO_LIMIT + 1],
    ['x.svg', 100],
    ['x.html', 10],
    ['x.exe', 10],
  ])
    assert.throws(() => uploadPolicy(name, size));
});
test('storage preview blocks public hosts, cross-origin writes and missing opt-in/header', () => {
  const request = (url, headers = {}, method = 'POST') => new Request(url, { method, headers });
  const headers = { 'x-codeemy-upload': '1', origin: 'http://localhost:3002' };
  assert.equal(
    localStorageRequestAllowed(request('http://localhost:3002/api/storage/upload', headers), true),
    true,
  );
  assert.equal(
    localStorageRequestAllowed(
      request('http://localhost:3002/api/storage/upload', {
        'x-codeemy-upload': '1',
        host: '127.0.0.1:3002',
        origin: 'http://127.0.0.1:3002',
      }),
      true,
    ),
    true,
  );
  assert.equal(
    localStorageRequestAllowed(
      request('http://localhost:3002/api/storage/upload', {
        'x-codeemy-upload': '1',
        host: 'public.example',
        origin: 'http://public.example',
      }),
      true,
    ),
    false,
  );
  assert.equal(
    localStorageRequestAllowed(request('http://localhost:3002/api/storage/upload', headers), false),
    false,
  );
  assert.equal(
    localStorageRequestAllowed(
      request('https://portal.example/api/storage/upload', { 'x-codeemy-upload': '1' }),
      true,
    ),
    false,
  );
  assert.equal(
    localStorageRequestAllowed(
      request('http://localhost:3002/api/storage/upload', {
        ...headers,
        origin: 'https://evil.example',
      }),
      true,
    ),
    false,
  );
  assert.equal(
    localStorageRequestAllowed(request('http://localhost:3002/api/storage/upload'), true),
    false,
  );
  assert.equal(
    localStorageRequestAllowed(
      request(
        'http://localhost:3002/api/storage/object',
        { 'sec-fetch-site': 'cross-site' },
        'GET',
      ),
      true,
    ),
    false,
  );
});
test('object access signatures bind to the exact app-generated object key', () => {
  process.env.CLOUDFLARE_R2_ENDPOINT =
    'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com';
  process.env.CLOUDFLARE_R2_BUCKET_NAME = 'test-bucket';
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'a'.repeat(32);
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'b'.repeat(64);
  const key = 'codeemy/uploads/00000000-0000-4000-a000-000000000001/image.png';
  assert.equal(validObjectKey(key), true);
  assert.equal(validObjectKey('../../secret'), false);
  const signature = objectSignature(key);
  assert.equal(validObjectSignature(key, signature), true);
  assert.equal(validObjectSignature(key.replace('image.png', 'other.png'), signature), false);
  assert.equal(validObjectSignature(key, 'a'.repeat(64)), false);
});
