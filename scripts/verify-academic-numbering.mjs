import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../src/lib/prisma.js';
import { ensureAcademicIdentity } from '../src/lib/server/academic-identity.js';
config({ path: ['.env.local', '.env'], quiet: true });
const db = getPrisma(),
  fixtures = [];
try {
  for (const role of ['STUDENT', 'STUDENT', 'MENTOR'])
    fixtures.push(
      await db.users.create({
        data: {
          firebase_uid: 'number-check-' + randomUUID(),
          email: 'number-check-' + randomUUID() + '@example.com',
          full_name: 'Temporary Number Check',
          role,
          status: 'INACTIVE',
          created_at: new Date('2026-01-02T03:04:05.123Z'),
        },
      }),
    );
  await Promise.all(
    fixtures.map((user) =>
      db.$transaction((tx) => ensureAcademicIdentity(tx, user), { timeout: 30000 }),
    ),
  );
  const profiles = await Promise.all(
    fixtures
      .slice(0, 2)
      .map((user) => db.student_profiles.findUnique({ where: { user_id: user.id } })),
  );
  assert.notEqual(profiles[0].registration_number, profiles[1].registration_number);
  const values = profiles
    .map((p) => BigInt(p.registration_number.replace('Codeemy', '')))
    .sort((a, b) => (a < b ? -1 : 1));
  assert.equal(values[1] - values[0], 1n);
  for (const profile of profiles)
    assert.equal(profile.admission_date.toISOString(), '2026-01-02T03:04:05.123Z');
  await Promise.all(
    fixtures.map((user) =>
      db.$transaction((tx) => ensureAcademicIdentity(tx, user), { timeout: 30000 }),
    ),
  );
  assert.equal(
    (await db.student_profiles.findUnique({ where: { user_id: fixtures[0].id } }))
      .registration_number,
    profiles[0].registration_number,
  );
  assert.equal(
    (
      await db.mentor_profiles.findUnique({ where: { user_id: fixtures[2].id } })
    ).created_at.toISOString(),
    '2026-01-02T03:04:05.123Z',
  );
  console.log(
    'PASS concurrent student allocation: unique consecutive Codeemy IDs, repeat calls preserve IDs, exact student/mentor creation timestamps',
  );
} finally {
  for (const user of fixtures) {
    await db.audit_logs.deleteMany({
      where: { action: 'STUDENT_NUMBER_ALLOCATED', entity_id: user.id },
    });
    await db.student_profiles.deleteMany({ where: { user_id: user.id } });
    await db.mentor_profiles.deleteMany({ where: { user_id: user.id } });
    await db.users.delete({ where: { id: user.id } });
  }
  await db.$disconnect();
  console.log('Temporary numbering test records removed');
}
