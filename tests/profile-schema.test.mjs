import test from 'node:test';
import assert from 'node:assert/strict';
import { profileDetails } from '../src/lib/server/profile.js';

test('student basic profile remains available before and after college migration', async () => {
  for (const available of [false, true]) {
    let selected;
    const db = {
      $queryRawUnsafe: async () => [{ available }],
      users: {
        findUnique: async (query) => {
          selected = query.select;
          return { id: 'own-user' };
        },
      },
    };
    const result = await profileDetails(db, { id: 'own-user', role: 'STUDENT' });
    assert.equal(result.capabilities.collegeName, available);
    assert.equal(Boolean(selected.student_profiles.select.college_name), available);
    assert.equal(selected.profile_image, true);
  }
});

test('mentor and admin profiles do not read the missing student relation', async () => {
  for (const role of ['MENTOR', 'ADMIN']) {
    const db = {
      users: {
        findUnique: async ({ where, select }) => {
          assert.equal(where.id, 'own-user');
          assert.equal(select.student_profiles, undefined);
          assert.equal(Boolean(select.mentor_profiles), role === 'MENTOR');
          return { id: where.id };
        },
      },
    };
    await profileDetails(db, { id: 'own-user', role });
  }
});
