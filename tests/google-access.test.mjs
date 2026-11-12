import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSessionAccount } from '../src/lib/server/session-account.js';
const google = {
  uid: 'verified-firebase-id',
  email: 'learner@example.com',
  name: 'Learner',
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
};
function database(actor, decision = null, request = null) {
  return {
    users: {
      findUnique: async ({ where }) => {
        assert.equal(where.firebase_uid, google.uid);
        return actor;
      },
    },
    audit_logs: {
      findFirst: async ({ where }) =>
        where.action === 'REGISTRATION_REQUESTED' ? request : decision,
    },
  };
}
test('new verified Google identity completes registration without gaining a portal role', async () => {
  const result = await resolveSessionAccount(database(null), google);
  assert.deepEqual(result, {
    needsRegistration: true,
    profile: { email: google.email, fullName: google.name },
  });
  assert.equal(Object.hasOwn(result, 'role'), false);
});
test('new password identities and unverified Google identities cannot bypass registration', async () => {
  for (const token of [
    { ...google, email_verified: false },
    { ...google, firebase: { sign_in_provider: 'password' } },
    { ...google, email: null },
  ])
    await assert.rejects(resolveSessionAccount(database(null), token), (e) => e.status === 403);
});
test('existing approved Google users keep the role assigned in the database', async () => {
  for (const role of ['ADMIN', 'MENTOR', 'STUDENT'])
    assert.deepEqual(
      await resolveSessionAccount(database({ id: 'user', role, status: 'ACTIVE' }), {
        ...google,
        role: 'ADMIN',
      }),
      { role },
    );
});
test('pending and rejected existing Google accounts remain blocked instead of re-registering', async () => {
  const actor = { id: 'user', role: 'STUDENT', status: 'INACTIVE' };
  await assert.rejects(
    resolveSessionAccount(database(actor, null, { id: 'request' }), google),
    (e) => e.status === 403 && e.message.includes('waiting for administrator approval'),
  );
  await assert.rejects(
    resolveSessionAccount(
      database(actor, { action: 'REGISTRATION_REJECTED', details: { reason: 'Verify college' } }),
      google,
    ),
    (e) => e.status === 403 && e.message.includes('Verify college'),
  );
});
