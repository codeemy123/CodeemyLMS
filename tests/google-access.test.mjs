
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

const adminGoogle = {
  uid: 'verified-admin-firebase-id',
  email: 'ci-admin@example.com',
  name: 'CI Administrator',
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
};

// Keep authorization tests independent from a developer's local .env values.
// The production code still reads process.env when no environment is supplied.
const testEnvironment = {
  LMS_ADMIN_EMAILS: adminGoogle.email,
  LMS_REQUIRE_VERIFIED_ADMIN_EMAIL: 'true',
  LMS_REQUIRE_GOOGLE_ADMIN_PROVIDER: 'true',
};

function database(actor, decision = null, request = null, expectedUid = google.uid) {
  return {
    users: {
      findUnique: async ({ where }) => {
        assert.equal(where.firebase_uid, expectedUid);
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
  const result = await resolveSessionAccount(database(null), google, testEnvironment);

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
  ]) {
    await assert.rejects(
      resolveSessionAccount(database(null), token, testEnvironment),
      (e) => e.status === 403,
    );
  }
});

test('existing approved official administrator is authorized as ADMIN', async () => {
  const actor = {
    id: 'admin-user',
    firebase_uid: adminGoogle.uid,
    email: adminGoogle.email,
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  const result = await resolveSessionAccount(
    database(actor, null, null, adminGoogle.uid),
    adminGoogle,
    testEnvironment,
  );

  assert.deepEqual(result, { role: 'ADMIN' });
});

test('official administrator is matched by email and gets the current Firebase UID', async () => {
  const existingAdmin = {
    id: 'admin-user',
    email: adminGoogle.email,
    role: 'ADMIN',
    status: 'ACTIVE',
    firebase_uid: 'stale-firebase-id',
  };
  let mappedUid;
  const db = {
    users: {
      findUnique: async () => null,
      findFirst: async () => existingAdmin,
      update: async ({ where, data }) => {
        assert.equal(where.id, existingAdmin.id);
        mappedUid = data.firebase_uid;
        return { ...existingAdmin, firebase_uid: data.firebase_uid };
      },
    },
  };

  const result = await resolveSessionAccount(db, adminGoogle, testEnvironment);

  assert.equal(mappedUid, adminGoogle.uid);
  assert.deepEqual(result, { role: 'ADMIN' });
});

test('existing approved Google users keep MENTOR and STUDENT roles from the database', async () => {
  for (const role of ['MENTOR', 'STUDENT']) {
    const actor = {
      id: 'user',
      firebase_uid: google.uid,
      email: google.email,
      role,
      status: 'ACTIVE',
    };

    const result = await resolveSessionAccount(database(actor), google, testEnvironment);

    assert.deepEqual(result, { role });
  }
});

test('pending and rejected existing Google accounts remain blocked instead of re-registering', async () => {
  const actor = {
    id: 'user',
    firebase_uid: google.uid,
    email: google.email,
    role: 'STUDENT',
    status: 'INACTIVE',
  };

  await assert.rejects(
    resolveSessionAccount(database(actor, null, { id: 'request' }), google, testEnvironment),
    (e) =>
      e.status === 403 &&
      e.message.includes('waiting for administrator approval'),
  );

  await assert.rejects(
    resolveSessionAccount(
      database(actor, {
        action: 'REGISTRATION_REJECTED',
        details: { reason: 'Verify college' },
      }),
      google,
      testEnvironment,
    ),
    (e) => e.status === 403 && e.message.includes('Verify college'),
  );
});
