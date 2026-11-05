import test from 'node:test';
import assert from 'node:assert/strict';
import { assertOrigin, uuid, numeric, roleAllowed, jsonBody } from '../src/lib/server/api.js';
import { courseScope, sessionScope, evaluateSubmission } from '../src/lib/server/data-access.js';
test('database writes reject missing, malformed and cross-site origins', () => {
  for (const origin of [undefined, 'bad', 'https://other.example'])
    assert.throws(
      () =>
        assertOrigin(
          new Request('https://lms.example/api/courses', {
            headers: origin ? { origin, host: 'lms.example' } : { host: 'lms.example' },
          }),
        ),
      { status: 403 },
    );
  assert.doesNotThrow(() =>
    assertOrigin(
      new Request('https://lms.example/api/courses', {
        headers: { origin: 'https://lms.example', host: 'lms.example' },
      }),
    ),
  );
});
test('database policy derives course/session access from the server actor ID', () => {
  const student = { id: 'student-id', role: 'STUDENT' },
    mentor = { id: 'mentor-id', role: 'MENTOR' };
  assert.equal(courseScope(student).OR[0].enrollments.some.student_id, 'student-id');
  assert.equal(courseScope(student).status, 'PUBLISHED');
  assert.equal(courseScope(mentor).OR[1].batches.some.mentor_id, 'mentor-id');
  assert.equal(sessionScope(student).batches.batch_members.some.student_id, 'student-id');
  assert.deepEqual(courseScope({ role: 'ADMIN' }), {});
  assert.throws(() => roleAllowed(student, ['ADMIN', 'MENTOR']), { status: 403 });
});
test('database validation rejects invalid IDs, marks and non-object JSON', async () => {
  assert.throws(() => uuid('not-a-uuid'), { status: 400 });
  for (const value of [NaN, Infinity, -1, 101, '90'])
    assert.throws(() => numeric(value), { status: 400 });
  await assert.rejects(
    jsonBody(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '[]',
      }),
    ),
    { status: 400 },
  );
});
test('a mentor cannot evaluate an unrelated student even when the course is visible', async () => {
  let updated = false;
  const db = {
    assignment_submissions: {
      findUnique: async () => ({
        student_id: 'other-student',
        assignments: { course_id: 'course-id', batch_id: 'other-batch', total_marks: 100 },
      }),
      update: async () => {
        updated = true;
      },
    },
    courses: { findFirst: async () => ({ id: 'course-id' }) },
    batch_members: { findFirst: async () => null },
  };
  await assert.rejects(
    evaluateSubmission(db, { id: 'mentor-id', role: 'MENTOR' }, 'assignment', 'id', 90, ''),
    { status: 403 },
  );
  assert.equal(updated, false);
});
