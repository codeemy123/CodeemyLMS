import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../src/lib/prisma.js';
import {
  courseScope,
  sessionScope,
  evaluateSubmission,
  saveAttendance,
} from '../src/lib/server/data-access.js';
config({ path: ['.env.local', '.env'], quiet: true });
const db = getPrisma(),
  marker = randomUUID();
const before = await db.users.count();
const rollback = new Error('TEST_ROLLBACK');
try {
  await db.$transaction(
    async (tx) => {
      async function person(role, suffix) {
        return tx.users.create({
          data: {
            firebase_uid: `db-check:${marker}:${suffix}`,
            email: `${marker}-${suffix}@example.invalid`,
            full_name: `Database check ${suffix}`,
            role,
          },
        });
      }
      const mentor = await person('MENTOR', 'mentor'),
        otherMentor = await person('MENTOR', 'other'),
        student = await person('STUDENT', 'student');
      const course = await tx.courses.create({
        data: {
          title: 'Database integration check',
          slug: `db-check-${marker}`,
          status: 'PUBLISHED',
          mentor_id: mentor.id,
        },
      });
      const hidden = await tx.courses.create({
        data: {
          title: 'Other course',
          slug: `db-other-${marker}`,
          status: 'PUBLISHED',
          mentor_id: otherMentor.id,
        },
      });
      const batch = await tx.batches.create({
        data: { name: `DB check ${marker}`, course_id: course.id, mentor_id: mentor.id },
      });
      await tx.batch_members.create({ data: { batch_id: batch.id, student_id: student.id } });
      const visible = await tx.courses.findMany({ where: courseScope(student) });
      assert.ok(visible.some((c) => c.id === course.id));
      assert.ok(!visible.some((c) => c.id === hidden.id));
      const session = await tx.class_sessions.create({
        data: {
          batch_id: batch.id,
          mentor_id: mentor.id,
          title: 'DB attendance check',
          start_at: new Date(),
        },
      });
      assert.equal(
        await tx.class_sessions.count({ where: { id: session.id, ...sessionScope(otherMentor) } }),
        0,
      );
      await saveAttendance(tx, mentor, session.id, [{ studentId: student.id, status: 'PRESENT' }]);
      assert.equal(
        (
          await tx.attendance.findUnique({
            where: { session_id_student_id: { session_id: session.id, student_id: student.id } },
          })
        ).status,
        'PRESENT',
      );
      await assert.rejects(saveAttendance(tx, student, session.id, []), { status: 403 });
      const assignment = await tx.assignments.create({
        data: {
          title: 'DB marks check',
          course_id: course.id,
          batch_id: batch.id,
          total_marks: 100,
        },
      });
      const submission = await tx.assignment_submissions.create({
        data: {
          assignment_id: assignment.id,
          student_id: student.id,
          submission_text: 'Test only',
        },
      });
      await assert.rejects(
        evaluateSubmission(tx, otherMentor, 'assignment', submission.id, 100, ''),
        { status: 404 },
      );
      await evaluateSubmission(
        tx,
        mentor,
        'assignment',
        submission.id,
        87,
        'Validated against PostgreSQL',
      );
      assert.equal(
        Number(
          (await tx.assignment_submissions.findUnique({ where: { id: submission.id } }))
            .marks_awarded,
        ),
        87,
      );
      assert.equal(await tx.notifications.count({ where: { user_id: student.id } }), 2);
      assert.equal(await tx.notifications.count({ where: { user_id: otherMentor.id } }), 0);
      throw rollback;
    },
    { timeout: 30000 },
  );
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  assert.equal(await db.users.count(), before, 'Test transaction must not persist users');
  await db.$disconnect();
}
console.log(
  'PostgreSQL course scope, attendance, marks and notification checks passed; all test rows rolled back.',
);
