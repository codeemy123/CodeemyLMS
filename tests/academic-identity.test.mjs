import test from 'node:test';
import assert from 'node:assert/strict';
import {
  studentRegistrationNumber,
  ensureAcademicIdentity,
} from '../src/lib/server/academic-identity.js';
test('student numbers pad to two digits without truncating larger totals', () => {
  for (const [n, expected] of [
    [1, 'Codeemy01'],
    [9, 'Codeemy09'],
    [10, 'Codeemy10'],
    [101, 'Codeemy101'],
  ])
    assert.equal(studentRegistrationNumber(n), expected);
});
test('allocation locks before reading the maximum and preserves existing numbers and dates', async () => {
  const createdAt = new Date('2026-01-02T03:04:05Z');
  let profile = null,
    audits = 0,
    locked = false;
  const tx = {
    users: { findUnique: async () => ({ created_at: createdAt }) },
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('pg_advisory_xact_lock')) {
        locked = true;
        return [{ locked: 1 }];
      }
      assert.ok(locked);
      return [{ last_number: '8' }];
    },
    student_profiles: {
      findUnique: async () => profile,
      upsert: async ({ create, update }) => {
        profile = profile ? { ...profile, ...update } : create;
      },
    },
    audit_logs: {
      create: async () => {
        audits++;
      },
    },
  };
  await ensureAcademicIdentity(tx, { id: 'student', role: 'STUDENT' });
  assert.equal(profile.registration_number, 'Codeemy09');
  assert.equal(profile.admission_date, createdAt);
  await ensureAcademicIdentity(tx, { id: 'student', role: 'STUDENT' }, { createdAt: new Date() });
  assert.equal(profile.registration_number, 'Codeemy09');
  assert.equal(profile.admission_date, createdAt);
  assert.equal(audits, 1);
});
