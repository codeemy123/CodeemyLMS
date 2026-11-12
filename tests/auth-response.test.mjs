import test from 'node:test';
import assert from 'node:assert/strict';
import { readAuthResponse } from '../src/features/auth/response.js';

test('hosting failures show a useful message instead of JSON parse errors', async () => {
  for (const body of ['', '<html>Function failed</html>'])
    await assert.rejects(
      readAuthResponse(new Response(body, { status: 500 })),
      /sign-in server is unavailable/,
    );
});

test('valid auth errors and success responses are preserved', async () => {
  assert.deepEqual(await readAuthResponse(Response.json({ role: 'STUDENT' })), { role: 'STUDENT' });
  assert.deepEqual(
    await readAuthResponse(Response.json({ error: 'Account pending' }, { status: 403 })),
    { error: 'Account pending' },
  );
});
