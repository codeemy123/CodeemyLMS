import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requireRegistrationPassword,
  submitRegistration,
} from '../src/lib/server/registrations.js';
const identity = { uid: 'verified-user', email: 'mentor@example.com' };
test('Google-only registration needs a linked password and preserves the same Firebase identity', () => {
  const account = {
    uid: identity.uid,
    email: identity.email,
    disabled: false,
    providerData: [{ providerId: 'google.com' }],
  };
  assert.throws(
    () => requireRegistrationPassword(identity, account),
    (e) => e.status === 400,
  );
  assert.doesNotThrow(() =>
    requireRegistrationPassword(identity, {
      ...account,
      providerData: [...account.providerData, { providerId: 'password' }],
    }),
  );
  assert.throws(
    () => requireRegistrationPassword(identity, { ...account, uid: 'another-user' }),
    (e) => e.status === 409,
  );
});
test('required registration contact and mentor expertise cannot be omitted through API calls', async () => {
  const db = {
    $transaction: () => {
      throw Error('Invalid details must never be persisted');
    },
  };
  const valid = {
    role: 'MENTOR',
    fullName: 'Mentor Name',
    phone: '9876543210',
    qualification: 'Python',
  };
  for (const change of [
    { fullName: '' },
    { phone: '' },
    { phone: '1     ' },
    { phone: 'not a phone' },
    { qualification: '' },
    { role: 'ADMIN' },
  ])
    await assert.rejects(
      submitRegistration(db, identity, { ...valid, ...change }),
      (e) => e.status === 400,
    );
});
