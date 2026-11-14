import test from 'node:test';
import assert from 'node:assert/strict';
import { errorResponse } from '../src/lib/server/api.js';

test('pending Prisma schema errors return an actionable service response', async () => {
  const response = errorResponse({ code: 'P2022', name: 'PrismaClientKnownRequestError' });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'The LMS database update is pending. Apply the latest Cloud SQL migration, then try again.',
  });
});

test('database permission errors return an actionable service response', async () => {
  const response = errorResponse({ code: 'P1010', name: 'PrismaClientKnownRequestError' });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error:
      'The LMS database user is missing permission for this workflow. Apply the latest Cloud SQL migration grants, then try again.',
  });
});
