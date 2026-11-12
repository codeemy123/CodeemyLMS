import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../src/lib/prisma.js';
import { startAttempt, finishAttempt } from '../src/lib/server/assessment-workflows.js';
import {
  requestAssessmentReopen,
  reviewAssessmentReopen,
  listReopenRequests,
} from '../src/lib/server/assessment-reopens.js';
config({ path: ['.env.local', '.env'], quiet: true });
const db = getPrisma(),
  rollback = new Error('TEST_ROLLBACK');
try {
  await db.$transaction(
    async (tx) => {
      const create = (role) =>
        tx.users.create({
          data: {
            firebase_uid: randomUUID(),
            email: randomUUID() + '@example.com',
            full_name: 'Temporary ' + role,
            role,
            status: 'ACTIVE',
          },
        });
      const admin = await create('ADMIN'),
        student = await create('STUDENT'),
        mentor = await create('MENTOR');
      const course = await tx.courses.create({
        data: {
          title: 'Reopen test',
          slug: randomUUID(),
          status: 'PUBLISHED',
          mentor_id: mentor.id,
        },
      });
      const batch = await tx.batches.create({
        data: { name: 'Reopen test', course_id: course.id, mentor_id: mentor.id },
      });
      await tx.batch_members.create({ data: { batch_id: batch.id, student_id: student.id } });
      const exam = await tx.assessments.create({
        data: {
          course_id: course.id,
          batch_id: batch.id,
          title: 'Reopen test',
          status: 'PUBLISHED',
          duration_minutes: 45,
          total_marks: 1,
          passing_marks: 1,
          start_at: new Date(Date.now() - 60000),
          end_at: new Date(Date.now() + 3600000),
        },
      });
      const question = await tx.questions.create({
        data: { assessment_id: exam.id, question_text: 'Test', question_type: 'MCQ', marks: 1 },
      });
      const yes = await tx.question_options.create({
        data: { question_id: question.id, option_text: 'Yes', is_correct: true },
      });
      await tx.question_options.create({
        data: { question_id: question.id, option_text: 'No', is_correct: false },
      });
      const first = await startAttempt(tx, student, exam.id);
      const closed = await finishAttempt(tx, student, first.attempt.id, {
        submit: true,
        reason: 'hidden',
        answers: [{ questionId: question.id, selectedOptionIds: [yes.id] }],
      });
      assert.equal(closed.attempt.status, 'EVALUATED');
      assert.equal(Number(closed.attempt.score), 1);
      const transactionOnly = { $transaction: (fn) => fn(tx) };
      const request = await requestAssessmentReopen(transactionOnly, student, {
        attemptId: first.attempt.id,
        reason: 'Accidental tab switch',
      });
      await assert.rejects(
        requestAssessmentReopen(transactionOnly, student, {
          attemptId: first.attempt.id,
          reason: 'Duplicate',
        }),
        (e) => e.status === 409,
      );
      for (const actor of [student, mentor])
        await assert.rejects(
          reviewAssessmentReopen(transactionOnly, actor, {
            requestId: request.requestId,
            decision: 'APPROVED',
          }),
          (e) => e.status === 403,
        );
      const window = {
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date(Date.now() + 300000).toISOString(),
      };
      await reviewAssessmentReopen(transactionOnly, admin, {
        requestId: request.requestId,
        decision: 'APPROVED',
        reason: 'Verified',
        ...window,
      });
      await assert.rejects(
        reviewAssessmentReopen(transactionOnly, admin, {
          requestId: request.requestId,
          decision: 'REJECTED',
          reason: 'Duplicate',
        }),
        (e) => e.status === 409,
      );
      await tx.assessments.update({
        where: { id: exam.id },
        data: { end_at: new Date(Date.now() - 500) },
      });
      const retake = await startAttempt(tx, student, exam.id, { reopen: true });
      assert.notEqual(retake.attempt.id, first.attempt.id);
      assert.equal(new Date(retake.deadline).getTime(), new Date(window.closeAt).getTime());
      assert.equal(
        Number(
          (await tx.assessment_attempts.findUnique({ where: { id: first.attempt.id } })).score,
        ),
        1,
      );
      const reentry = await startAttempt(tx, student, exam.id);
      assert.equal(reentry.attempt.id, retake.attempt.id);
      assert.equal(reentry.attempt.status, 'EVALUATED');
      await assert.rejects(
        startAttempt(tx, student, exam.id, { reopen: true }),
        (e) => e.status === 403,
      );
      assert.equal(
        await tx.assessment_attempts.count({
          where: { assessment_id: exam.id, student_id: student.id },
        }),
        2,
      );
      const request2 = await requestAssessmentReopen(transactionOnly, student, {
        attemptId: retake.attempt.id,
        reason: 'Review again',
      });
      await reviewAssessmentReopen(transactionOnly, admin, {
        requestId: request2.requestId,
        decision: 'REJECTED',
        reason: 'No further attempt',
      });
      const list = await listReopenRequests(tx, student);
      assert.equal(
        list.requests.find((r) => r.id === request2.requestId).reviewReason,
        'No further attempt',
      );
      assert.ok(list.requests.find((r) => r.id === request.requestId).used);
      const request3 = await requestAssessmentReopen(transactionOnly, student, {
        attemptId: retake.attempt.id,
        reason: 'Future access',
      });
      await reviewAssessmentReopen(transactionOnly, admin, {
        requestId: request3.requestId,
        decision: 'APPROVED',
        openAt: new Date(Date.now() + 600000).toISOString(),
        closeAt: new Date(Date.now() + 1200000).toISOString(),
      });
      await assert.rejects(
        startAttempt(tx, student, exam.id, { reopen: true }),
        (e) => e.status === 409,
      );
      assert.ok(
        await tx.notifications.count({ where: { user_id: admin.id, type: 'ASSESSMENT_REOPEN' } }),
      );
      assert.ok(
        await tx.notifications.count({ where: { user_id: student.id, type: 'ASSESSMENT_REOPEN' } }),
      );
      console.log(
        'PASS one-time attempt, tab-switch reason, Admin notifications, request dedupe, Admin-only approve/reject, one-use windowed retake, history, reentry lock and future-window block',
      );
      throw rollback;
    },
    { timeout: 60000 },
  );
} catch (e) {
  if (e !== rollback) throw e;
  console.log('All test records and notifications rolled back');
} finally {
  await db.$disconnect();
}
