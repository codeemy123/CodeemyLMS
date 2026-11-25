import test from 'node:test';
import assert from 'node:assert/strict';
import { errorResponse } from '../src/lib/server/api.js';

test('pending Prisma schema errors return an actionable service response', async () => {
  const response = errorResponse({ code: 'P2022', name: 'PrismaClientKnownRequestError' });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'A required database table or column is missing. Run the latest database migration and try again.',
  });
});

test('database permission errors return an actionable service response', async () => {
  const response = errorResponse({ code: 'P1010', name: 'PrismaClientKnownRequestError' });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error:
      'The database user is missing a required permission. Contact the administrator to apply the latest migration grants.',
  });
});
