import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../src/lib/prisma.js';
import { workflowRead, workflowWrite } from '../src/lib/server/learning-workflows.js';
import {
  startAttempt,
  finishAttempt,
  scoreChoice,
  assessmentDeadline,
  finalizeExpiredAssessments,
} from '../src/lib/server/assessment-workflows.js';
config({ path: ['.env.local', '.env'], quiet: true });
if (process.env.TEST_DB_PROXY_PORT) {
  const u = new URL(process.env.DATABASE_URL);
  u.port = process.env.TEST_DB_PROXY_PORT;
  process.env.DATABASE_URL = u.href;
}
const db = getPrisma(),
  marker = randomUUID(),
  rollback = new Error('VERIFIED_ROLLBACK');
try {
  await db.$transaction(
    async (tx) => {
      const actor = async (role) =>
        tx.users.create({
          data: {
            firebase_uid: marker + role,
            email: marker + role + '@example.invalid',
            full_name: 'Workflow test ' + role,
            role,
          },
        });
      const student = await actor('STUDENT'),
        mentor = await actor('MENTOR'),
        other = await tx.users.create({
          data: {
            firebase_uid: marker + 'other',
            email: marker + 'other@example.invalid',
            full_name: 'Other student',
            role: 'STUDENT',
          },
        });
      const course = await tx.courses.create({
        data: { title: marker, slug: marker, status: 'PUBLISHED', mentor_id: mentor.id },
      });
      const batch = await tx.batches.create({
        data: { name: marker, course_id: course.id, mentor_id: mentor.id },
      });
      await tx.batch_members.create({ data: { batch_id: batch.id, student_id: student.id } });
      const module = await tx.course_modules.create({
        data: { course_id: course.id, title: 'Module' },
      });
      const lesson = await tx.lessons.create({
        data: { module_id: module.id, title: 'Published lesson', is_published: true },
      });
      await workflowWrite(tx, student, 'progress', {
        id: lesson.id,
        completed: true,
        position: 42,
      });
      assert.equal(
        (await workflowRead(tx, student, 'progress')).records[0].lesson_progress[0]
          .last_position_seconds,
        42,
      );
      await assert.rejects(
        workflowWrite(tx, other, 'progress', { id: lesson.id, completed: true }),
        (e) => e.status === 404,
      );
      console.log('PASS lesson persistence and unassigned student denial');
      const performance = await workflowRead(tx, mentor, 'performance');
      assert.equal(performance.records.find((r) => r.title === student.full_name).completed, 1);
      await assert.rejects(workflowRead(tx, student, 'performance'), (e) => e.status === 403);
      console.log('PASS exact-batch mentor performance report and Student denial');
      const project = await tx.projects.create({
        data: { course_id: course.id, title: 'Project' },
      });
      const submitted = await workflowWrite(tx, student, 'projects', {
        id: project.id,
        description: 'My project',
        repositoryUrl: 'https://example.com/repo',
      });
      await workflowWrite(tx, mentor, 'projects', {
        action: 'evaluate',
        id: submitted.submission.id,
        marks: 80,
        feedback: 'Reviewed',
      });
      assert.equal(
        Number(
          (await workflowRead(tx, student, 'projects')).records[0].project_submissions[0]
            .marks_awarded,
        ),
        80,
      );
      console.log('PASS project submission, mentor evaluation and persisted student score');
      const q = await workflowWrite(tx, student, 'queries', {
        courseId: course.id,
        subject: 'Help',
        message: 'Question',
      });
      await workflowWrite(tx, mentor, 'queries', {
        action: 'reply',
        id: q.query.id,
        message: 'Answer',
        resolve: true,
      });
      assert.equal((await workflowRead(tx, student, 'queries')).records[0].status, 'RESOLVED');
      await assert.rejects(
        workflowWrite(tx, other, 'queries', { action: 'reply', id: q.query.id, message: 'Attack' }),
        (e) => e.status === 404,
      );
      console.log('PASS routed query replies, resolution and cross-user denial');
      const assessment = await tx.assessments.create({
        data: {
          course_id: course.id,
          batch_id: batch.id,
          title: 'Exam',
          status: 'PUBLISHED',
          duration_minutes: 45,
          total_marks: 10,
        },
      });
      const question = await tx.questions.create({
        data: {
          assessment_id: assessment.id,
          question_text: 'Select correct',
          question_type: 'MCQ',
          marks: 10,
        },
      });
      const option = await tx.question_options.create({
        data: { question_id: question.id, option_text: 'Correct', is_correct: true },
      });
      await tx.question_options.create({
        data: { question_id: question.id, option_text: 'Wrong', is_correct: false },
      });
      const started = await startAttempt(tx, student, assessment.id);
      assert.equal(Object.hasOwn(started.questions[0].question_options[0], 'is_correct'), false);
      const resumed = await startAttempt(tx, student, assessment.id);
      assert.equal(started.attempt.id, resumed.attempt.id);
      await assert.rejects(startAttempt(tx, other, assessment.id), (e) => e.status === 404);
      const result = await finishAttempt(tx, student, started.attempt.id, {
        answers: [{ questionId: question.id, selectedOptionIds: [option.id] }],
        submit: true,
      });
      assert.equal(Number(result.attempt.score), 10);
      assert.equal(result.attempt.status, 'EVALUATED');
      assert.equal(
        Number(
          (await finishAttempt(tx, student, started.attempt.id, { submit: true, answers: [] }))
            .attempt.score,
        ),
        10,
      );
      console.log(
        'PASS server grading, no leaked answer keys, single attempt and immutable submitted score',
      );
      const timed = await tx.assessments.create({
        data: {
          course_id: course.id,
          batch_id: batch.id,
          title: 'Timeout',
          status: 'PUBLISHED',
          duration_minutes: 1,
        },
      });
      const timedQuestion = await tx.questions.create({
        data: {
          assessment_id: timed.id,
          question_text: 'Select correct',
          question_type: 'MCQ',
          marks: 10,
        },
      });
      const timedOption = await tx.question_options.create({
        data: { question_id: timedQuestion.id, option_text: 'Correct', is_correct: true },
      });
      const expired = await tx.assessment_attempts.create({
        data: {
          assessment_id: timed.id,
          student_id: student.id,
          started_at: new Date(Date.now() - 120000),
        },
      });
      const expiredResult = await finishAttempt(tx, student, expired.id, {
        submit: true,
        answers: [{ questionId: timedQuestion.id, selectedOptionIds: [timedOption.id] }],
      });
      assert.equal(Number(expiredResult.attempt.score), 0);
      console.log('PASS late answers ignored after server deadline');
      const abandoned = await tx.assessment_attempts.create({
        data: {
          assessment_id: timed.id,
          student_id: other.id,
          started_at: new Date(Date.now() - 120000),
        },
      });
      await finalizeExpiredAssessments({
        $queryRaw: async (...args) =>
          (await tx.$queryRaw(...args)).filter((row) => row.id === abandoned.id),
        $transaction: (handler) => handler(tx),
      });
      assert.equal(
        (await tx.assessment_attempts.findUnique({ where: { id: abandoned.id } })).status,
        'EVALUATED',
      );
      console.log(
        'PASS scheduled finalizer closes an abandoned expired attempt without browser reconnect',
      );
      throw rollback;
    },
    { timeout: 60000 },
  );
} catch (e) {
  if (e !== rollback) throw e;
} finally {
  await db.$disconnect();
}
console.log('PASS all temporary workflow fixtures rolled back');
