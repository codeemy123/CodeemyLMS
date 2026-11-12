import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from '@playwright/test';
import { getPrisma } from '../src/lib/prisma.js';
config({ path: ['.env.local', '.env'], quiet: true });
if (process.env.TEST_DB_PROXY_PORT) {
  const url = new URL(process.env.DATABASE_URL);
  url.port = process.env.TEST_DB_PROXY_PORT;
  process.env.DATABASE_URL = url.href;
}
const origin = 'http://127.0.0.1:3005';
const db = getPrisma(),
  auth = getAuth(
    initializeApp(
      { projectId: process.env.FIREBASE_PROJECT_ID, credential: applicationDefault() },
      'learning-api-test',
    ),
  );
const marker = randomUUID(),
  identities = [],
  users = [],
  cookies = {},
  created = {};
let browser;
async function call(role, path, method = 'GET', body) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      cookie: cookies[role] || '',
      origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
async function adminCreate(entity, data) {
  const result = await call('ADMIN', '/api/admin/records/' + entity, 'POST', data);
  assert.equal(result.response.status, 200, entity + ': ' + (result.data.error || 'created'));
  return result.data.record;
}
try {
  for (const role of ['ADMIN', 'MENTOR', 'STUDENT']) {
    const password = randomBytes(24).toString('base64url');
    const identity = await auth.createUser({
      email: `workflow-${role.toLowerCase()}-${marker}@example.com`,
      password,
      displayName: 'Workflow ' + role,
    });
    identities.push(identity.uid);
    const user = await db.users.create({
      data: {
        firebase_uid: identity.uid,
        email: identity.email,
        full_name: identity.displayName,
        role,
      },
    });
    users.push(user);
    created[role] = user;
    const login = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
        process.env.FIREBASE_WEB_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity.email, password, returnSecureToken: true }),
      },
    );
    const token = await login.json();
    assert.equal(login.status, 200, 'Firebase test login');
    const session = await fetch(origin + '/api/auth/session', {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token.idToken }),
    });
    assert.equal(session.status, 200, 'Session issued');
    cookies[role] = session.headers.get('set-cookie').split(';')[0];
  }
  const course = await db.courses.create({
    data: {
      title: 'Workflow ' + marker,
      slug: marker,
      status: 'PUBLISHED',
      mentor_id: created.MENTOR.id,
    },
  });
  created.course = course.id;
  const batch = await db.batches.create({
    data: { name: 'Workflow batch', course_id: course.id, mentor_id: created.MENTOR.id },
  });
  created.batch = batch.id;
  await db.batch_members.create({ data: { batch_id: batch.id, student_id: created.STUDENT.id } });
  const module = await adminCreate('modules', { course_id: course.id, title: 'Workflow module' });
  const lesson = await adminCreate('lessons', {
    module_id: module.id,
    title: 'Workflow lesson',
    is_published: true,
    content: 'Real database lesson content',
  });
  await adminCreate('resources', {
    course_id: course.id,
    title: 'Workflow material',
    file_url: 'https://example.com/material.pdf',
    resource_type: 'DOCUMENT',
  });
  const project = await adminCreate('projects', {
    course_id: course.id,
    title: 'Workflow project',
  });
  assert.equal(
    (
      await call('STUDENT', '/api/workflows/progress', 'POST', {
        id: lesson.id,
        completed: true,
        position: 20,
      })
    ).response.status,
    200,
  );
  const progress = await call('STUDENT', '/api/workflows/progress');
  assert.equal(
    progress.data.records.find((l) => l.id === lesson.id).lesson_progress[0].is_completed,
    true,
  );
  const submission = await call('STUDENT', '/api/workflows/projects', 'POST', {
    id: project.id,
    description: 'API project',
    repositoryUrl: 'https://example.com/repo',
  });
  assert.equal(submission.response.status, 200);
  assert.equal(
    (
      await call('MENTOR', '/api/workflows/projects', 'POST', {
        action: 'evaluate',
        id: submission.data.submission.id,
        marks: 85,
        feedback: 'API reviewed',
      })
    ).response.status,
    200,
  );
  assert.equal(
    (
      await call('STUDENT', '/api/workflows/projects', 'POST', {
        action: 'evaluate',
        id: submission.data.submission.id,
        marks: 100,
        feedback: 'Forbidden',
      })
    ).response.status,
    403,
  );
  const query = await call('STUDENT', '/api/workflows/queries', 'POST', {
    courseId: course.id,
    subject: 'Workflow query',
    message: 'Help with lesson',
  });
  assert.equal(query.response.status, 200);
  created.query = query.data.query.id;
  assert.equal(
    (
      await call('MENTOR', '/api/workflows/queries', 'POST', {
        id: created.query,
        action: 'reply',
        message: 'Workflow reply',
        resolve: true,
      })
    ).response.status,
    200,
  );
  const assessment = await adminCreate('assessments', {
    course_id: course.id,
    batch_id: batch.id,
    title: 'Workflow assessment',
    status: 'PUBLISHED',
    duration_minutes: 45,
    total_marks: 12,
    passing_marks: 5,
  });
  created.assessment = assessment.id;
  const question = await adminCreate('questions', {
    assessment_id: assessment.id,
    question_text: 'Workflow question',
    question_type: 'MCQ',
    marks: 10,
  });
  const option = await adminCreate('options', {
    question_id: question.id,
    option_text: 'Correct choice',
    is_correct: true,
  });
  await adminCreate('options', {
    question_id: question.id,
    option_text: 'Wrong choice',
    is_correct: false,
  });
  const written = await adminCreate('questions', {
    assessment_id: assessment.id,
    question_text: 'Explain your answer',
    question_type: 'SHORT_ANSWER',
    marks: 2,
    sort_order: 1,
  });
  const attempt = await call('STUDENT', `/api/assessments/${assessment.id}/attempt`, 'POST');
  assert.equal(attempt.response.status, 200);
  assert.equal(Object.hasOwn(attempt.data.questions[0].question_options[0], 'is_correct'), false);
  const finished = await call(
    'STUDENT',
    `/api/assessment-attempts/${attempt.data.attempt.id}`,
    'PATCH',
    {
      submit: true,
      answers: [
        { questionId: question.id, selectedOptionIds: [option.id] },
        { questionId: written.id, answerText: 'My written answer' },
      ],
    },
  );
  assert.equal(Number(finished.data.attempt.score), 10);
  assert.equal(finished.data.attempt.status, 'SUBMITTED');
  const evaluation = await call(
    'MENTOR',
    `/api/assessment-attempts/${attempt.data.attempt.id}/evaluation`,
    'POST',
    { marks: [{ questionId: written.id, score: 2 }] },
  );
  assert.equal(evaluation.response.status, 200);
  assert.equal(evaluation.data.score, 12);
  assert.equal(
    (
      await call(
        'STUDENT',
        `/api/assessment-attempts/${attempt.data.attempt.id}/evaluation`,
        'POST',
        { marks: [{ questionId: written.id, score: 2 }] },
      )
    ).response.status,
    403,
  );
  const ranking = await call(
    'STUDENT',
    `/api/leaderboard?assessmentId=${assessment.id}&batchId=${batch.id}`,
  );
  assert.equal(ranking.data.records[0].score, '12');
  console.log(
    'PASS authenticated 3-role workflow API, persistence, permission denial, server grading and batch leaderboard',
  );
  const certificate = await db.certificates.create({
    data: {
      course_id: course.id,
      student_id: created.STUDENT.id,
      certificate_number: 'TEST-' + marker,
    },
  });
  const pdf = await fetch(origin + `/api/certificates/${certificate.id}/download`, {
    headers: { cookie: cookies.STUDENT },
  });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.equal(
    (
      await call('STUDENT', '/api/certificates', 'POST', {
        id: certificate.id,
        action: 'revoke',
        reason: 'Forbidden',
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await call('ADMIN', '/api/certificates', 'POST', {
        id: certificate.id,
        action: 'revoke',
        reason: 'Test revocation',
      })
    ).response.status,
    200,
  );
  assert.equal(
    (
      await fetch(origin + `/api/certificates/${certificate.id}/download`, {
        headers: { cookie: cookies.STUDENT },
      })
    ).status,
    410,
  );
  assert.equal(
    (
      await call('ADMIN', '/api/certificates', 'POST', {
        id: certificate.id,
        action: 'reissue',
        reason: 'Test reissue',
      })
    ).response.status,
    200,
  );
  const issued = await call('STUDENT', '/api/certificates');
  const cert = issued.data.certificates.find((c) => c.id === certificate.id);
  assert.equal(cert.revoked, false);
  assert.equal(cert.history.length, 2);
  assert.notEqual(cert.certificate_number, 'TEST-' + marker);
  console.log(
    'PASS certificate ownership, PDF download, Admin-only revoke/reissue and retained history',
  );
  const browserExam = await adminCreate('assessments', {
    course_id: course.id,
    batch_id: batch.id,
    title: 'Browser workflow exam',
    status: 'PUBLISHED',
    duration_minutes: 45,
    total_marks: 1,
    passing_marks: 1,
  });
  created.extraAssessment = browserExam.id;
  const browserQuestion = await adminCreate('questions', {
    assessment_id: browserExam.id,
    question_text: 'Choose the browser answer',
    question_type: 'MCQ',
    marks: 1,
  });
  await adminCreate('options', {
    question_id: browserQuestion.id,
    option_text: 'UI correct',
    is_correct: true,
  });
  await adminCreate('options', {
    question_id: browserQuestion.id,
    option_text: 'UI wrong',
    is_correct: false,
  });
  browser = await chromium.launch({ headless: true });
  for (const [role, paths] of [
    [
      'STUDENT',
      [
        '/student/materials',
        '/student/progress',
        '/student/projects',
        '/student/mentor',
        '/student/assessments',
        '/student/leaderboard',
      ],
    ],
    [
      'MENTOR',
      ['/mentor/projects', '/mentor/feedback', '/mentor/performance', '/mentor/assessments'],
    ],
  ]) {
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: 'codeemy_session',
        value: cookies[role].slice('codeemy_session='.length),
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await context.newPage();
    for (const path of paths) {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin + path);
      await page.waitForTimeout(700);
      assert.equal(errors.length, 0, path + ' browser error');
      assert.equal(
        await page.getByText('This workflow is still a preview.', { exact: false }).count(),
        0,
        path + ' preview warning',
      );
    }
    if (role === 'STUDENT') {
      await page.goto(origin + '/student/progress');
      await page.getByText('Workflow lesson', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Mark incomplete', exact: true }).click();
      await page.getByRole('button', { name: 'Mark complete', exact: true }).waitFor();
      await page.goto(origin + '/student/assessments');
      await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
      await page.getByLabel('UI correct', { exact: true }).check();
      await page.getByRole('button', { name: 'Submit assessment', exact: true }).click();
      await page.getByText('Status: EVALUATED', { exact: true }).waitFor();
      assert.equal(
        Number(
          (
            await db.assessment_attempts.findFirst({
              where: { assessment_id: browserExam.id, student_id: created.STUDENT.id },
            })
          ).score,
        ),
        1,
      );
    }
    await context.close();
  }
  console.log('PASS 10 authenticated Student/Mentor browser pages and persisted lesson toggle');
  console.log('PASS real Student browser fullscreen assessment and server-persisted score');
} finally {
  await browser?.close();
  const ids = users.map((u) => u.id);
  if (created.assessment)
    await db.assessments.delete({ where: { id: created.assessment } }).catch(() => {});
  if (created.extraAssessment)
    await db.assessments.delete({ where: { id: created.extraAssessment } }).catch(() => {});
  if (created.query)
    await db.student_queries.delete({ where: { id: created.query } }).catch(() => {});
  await db.notifications.deleteMany({ where: { user_id: { in: ids } } });
  await db.audit_logs.deleteMany({ where: { user_id: { in: ids } } });
  if (created.course) {
    await db.projects.deleteMany({ where: { course_id: created.course } });
    await db.batches.deleteMany({ where: { course_id: created.course } });
    await db.courses.delete({ where: { id: created.course } });
  }
  await db.users.deleteMany({ where: { id: { in: ids } } });
  for (const uid of identities) await auth.deleteUser(uid).catch(() => {});
  await db.$disconnect();
  console.log('Temporary workflow API fixtures cleaned up.');
}
