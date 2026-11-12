import test from 'node:test';
import assert from 'node:assert/strict';
import { resourceConfig, validateAdminFields } from '../src/lib/server/admin-records.js';

test('Admin resource allowlist excludes audit tables and prototype properties', () => {
  for (const name of ['audit_logs', 'answers', '__proto__', 'constructor'])
    assert.throws(
      () => resourceConfig(name),
      (error) => error.status === 404,
    );
});

test('editable account fields cannot promote roles or replace Firebase identity', () => {
  for (const field of ['role', 'firebase_uid', 'email'])
    assert.throws(
      () => validateAdminFields('people', { [field]: 'ADMIN' }),
      (error) => error.status === 400,
    );
});

test('record validation rejects executable links, malformed URLs and coerced boolean/numeric input', () => {
  for (const value of ['javascript:alert(1)', 'http://example.com', 'https://'])
    assert.throws(
      () => validateAdminFields('resources', { file_url: value }),
      (error) => error.status === 400,
    );
  assert.throws(
    () => validateAdminFields('lessons', { is_published: 'false' }),
    (error) => error.status === 400,
  );
  assert.throws(
    () => validateAdminFields('assignments', { total_marks: true }),
    (error) => error.status === 400,
  );
});
