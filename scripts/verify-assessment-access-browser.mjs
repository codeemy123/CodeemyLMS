import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from '@playwright/test';
import { getPrisma } from '../src/lib/prisma.js';
config({ path: ['.env.local', '.env'], quiet: true });
const origin = process.argv.includes('--live')
    ? 'https://lerno.codeemy.in'
    : 'http://127.0.0.1:3013',
  db = getPrisma(),
  fixtures = [],
  cookies = {},
  created = {};
let browser;
const auth = getAuth(
  initializeApp(
    { projectId: 'codeemylms', credential: applicationDefault() },
    'assessment-access-browser',
  ),
);
async function call(role, path, method = 'GET', body) {
  const r = await fetch(origin + path, {
    method,
    headers: {
      origin,
      cookie: cookies[role],
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
try {
  for (const role of ['ADMIN', 'MENTOR', 'STUDENT']) {
    const password = randomBytes(24).toString('base64url'),
      identity = await auth.createUser({
        email: 'exam-access-' + randomUUID() + '@example.com',
        password,
      });
    const fixture = { uid: identity.uid };
    fixtures.push(fixture);
    const user = await db.users.create({
      data: {
        firebase_uid: identity.uid,
        email: identity.email,
        full_name: 'Temporary ' + role,
        role,
        status: 'ACTIVE',
      },
    });
    fixture.id = user.id;
    created[role] = user;
    const sign = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
        process.env.FIREBASE_WEB_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity.email, password, returnSecureToken: true }),
      },
    );
    const token = await sign.json();
    const session = await fetch(origin + '/api/auth/session', {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token.idToken }),
    });
    assert.equal(session.status, 200);
    cookies[role] = session.headers.get('set-cookie').split(';')[0];
  }
  const course = await db.courses.create({
    data: {
      title: 'Temporary access course',
      slug: randomUUID(),
      status: 'PUBLISHED',
      mentor_id: created.MENTOR.id,
    },
  });
  created.course = course.id;
  const batch = await db.batches.create({
    data: { name: 'Temporary access batch', course_id: course.id, mentor_id: created.MENTOR.id },
  });
  created.batch = batch.id;
  await db.batch_members.create({ data: { batch_id: batch.id, student_id: created.STUDENT.id } });
  const exam = await db.assessments.create({
    data: {
      course_id: course.id,
      batch_id: batch.id,
      title: 'Temporary access exam',
      status: 'PUBLISHED',
      duration_minutes: 45,
      total_marks: 1,
      passing_marks: 1,
      start_at: new Date(Date.now() - 60000),
      end_at: new Date(Date.now() + 3600000),
    },
  });
  created.exam = exam.id;
  const question = await db.questions.create({
    data: {
      assessment_id: exam.id,
      question_text: 'Select an answer',
      question_type: 'MCQ',
      marks: 1,
    },
  });
  await db.question_options.createMany({
    data: [
      { question_id: question.id, option_text: 'Correct', is_correct: true },
      { question_id: question.id, option_text: 'Wrong', is_correct: false },
    ],
  });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  async function pageFor(role) {
    const ctx = await browser.newContext({ timezoneId: 'Asia/Kolkata' });
    await ctx.addCookies([
      { name: 'codeemy_session', value: cookies[role].slice(16), url: origin, httpOnly: true },
    ]);
    const p = await ctx.newPage();
    p.setDefaultTimeout(25000);
    return p;
  }
  const page = await pageFor('STUDENT');
  await page.goto(origin + '/student/assessments');
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await page.getByRole('heading', { name: /Time remaining:/ }).waitFor();
  assert.ok(await page.evaluate(() => Boolean(document.fullscreenElement)));
  await page.getByLabel('Correct', { exact: true }).check();
  const timer = await page.getByRole('heading', { name: /Time remaining:/ }).textContent();
  await page.waitForTimeout(1200);
  assert.notEqual(
    await page.getByRole('heading', { name: /Time remaining:/ }).textContent(),
    timer,
  );
  await page.evaluate(() => document.exitFullscreen());
  await page.getByText('This attempt is closed.', { exact: false }).waitFor();
  let attempts = await db.assessment_attempts.findMany({
    where: { assessment_id: exam.id, student_id: created.STUDENT.id },
    orderBy: { started_at: 'desc' },
  });
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].status, 'EVALUATED');
  assert.equal(Number(attempts[0].score), 1);
  await page.getByLabel('Reason for another attempt').fill('Accidental fullscreen exit');
  await page.getByRole('button', { name: 'Request Admin approval', exact: true }).click();
  await page.getByText('Your request is awaiting Admin approval.', { exact: true }).waitFor();
  assert.equal(
    (
      await call('MENTOR', '/api/assessment-reopens', 'PATCH', {
        requestId: randomUUID(),
        decision: 'APPROVED',
      })
    ).status,
    403,
  );
  const admin = await pageFor('ADMIN');
  await admin.goto(origin + '/admin/assessments');
  let row = admin
    .locator('article.assessment-access-box')
    .filter({ hasText: 'Accidental fullscreen exit' });
  await row.getByLabel('Review note').fill('Verified support request');
  await row.getByRole('button', { name: 'Approve one attempt', exact: true }).click();
  await row.getByText('Status: APPROVED', { exact: true }).waitFor();
  await page.goto(origin + '/student/assessments');
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start approved attempt', exact: true }).click();
  await page.getByRole('heading', { name: /Time remaining:/ }).waitFor();
  const second = await page.context().newPage();
  await second.goto('about:blank');
  await second.bringToFront();
  if (!(await page.evaluate(() => document.hidden))) {
    console.log(
      'Headless tab remains visible; verifying the visibility-change handler with a controlled hidden event.',
    );
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }
  await page.getByText('This attempt is closed.', { exact: false }).waitFor();
  await second.close();
  await page.bringToFront();
  await page.evaluate(() => {
    delete document.hidden;
  });
  attempts = await db.assessment_attempts.findMany({
    where: { assessment_id: exam.id, student_id: created.STUDENT.id },
    orderBy: { started_at: 'desc' },
  });
  assert.equal(attempts.length, 2);
  assert.ok(attempts.every((a) => a.status !== 'IN_PROGRESS'));
  const reason = await db.audit_logs.findFirst({
    where: { action: 'ASSESSMENT_FINISHED', entity_id: attempts[0].id },
  });
  assert.ok(['hidden', 'focus', 'fullscreen'].includes(reason.details.reason));
  await page.getByLabel('Reason for another attempt').fill('Second review request');
  await page.getByRole('button', { name: 'Request Admin approval', exact: true }).click();
  await page.getByText('Your request is awaiting Admin approval.', { exact: true }).waitFor();
  await admin.reload();
  row = admin.locator('article.assessment-access-box').filter({ hasText: 'Second review request' });
  await row.getByLabel('Review note').fill('Only one additional attempt was authorized');
  await row.getByRole('button', { name: 'Reject request', exact: true }).click();
  await row.getByText('Status: REJECTED', { exact: true }).waitFor();
  const denied = await call('STUDENT', '/api/assessments/' + exam.id + '/attempt', 'POST', {
    reopen: true,
  });
  assert.equal(denied.status, 403);
  const future = await db.assessments.create({
    data: {
      course_id: course.id,
      batch_id: batch.id,
      title: 'Future exam',
      status: 'PUBLISHED',
      duration_minutes: 45,
      start_at: new Date(Date.now() + 3600000),
      end_at: new Date(Date.now() + 7200000),
    },
  });
  created.future = future.id;
  assert.equal(
    (await call('STUDENT', '/api/assessments/' + future.id + '/attempt', 'POST')).status,
    409,
  );
  const assignment = await db.assignments.create({
    data: {
      course_id: course.id,
      batch_id: batch.id,
      title: 'One submission',
      due_date: new Date(Date.now() + 3600000),
    },
  });
  assert.equal(
    (
      await call('STUDENT', '/api/assignments/' + assignment.id + '/submission', 'POST', {
        submissionText: 'First',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call('STUDENT', '/api/assignments/' + assignment.id + '/submission', 'POST', {
        submissionText: 'Second',
      })
    ).status,
    409,
  );
  await db.assignments.update({
    where: { id: assignment.id },
    data: { due_date: new Date(Date.now() - 1000) },
  });
  const expired = await db.assignments.create({
    data: {
      course_id: course.id,
      batch_id: batch.id,
      title: 'Past due',
      due_date: new Date(Date.now() - 60000),
    },
  });
  assert.equal(
    (
      await call('STUDENT', '/api/assignments/' + expired.id + '/submission', 'POST', {
        submissionText: 'Late',
      })
    ).status,
    403,
  );
  console.log(
    'PASS BROWSER: countdown, fullscreen-exit and visibility-change lock, student reason request, Admin approve/reject, one-use retake, history, window enforcement, Admin-only permissions; assignments deadline + one submission',
  );
} finally {
  if (browser) await browser.close();
  const ids = fixtures.map((f) => f.id).filter(Boolean);
  const requests = await db.audit_logs.findMany({
    where: { action: 'ASSESSMENT_REOPEN_REQUESTED', user_id: { in: ids } },
    select: { id: true },
  });
  const refs = [created.exam, created.future, ...requests.map((r) => r.id)].filter(Boolean);
  await db.notifications.deleteMany({
    where: { OR: [{ user_id: { in: ids } }, { reference_id: { in: refs } }] },
  });
  await db.audit_logs.deleteMany({
    where: {
      OR: [
        { user_id: { in: ids } },
        { action: 'STUDENT_NUMBER_ALLOCATED', entity_id: { in: ids } },
      ],
    },
  });
  if (created.course) {
    await db.assessments.deleteMany({ where: { course_id: created.course } });
    await db.assignments.deleteMany({ where: { course_id: created.course } });
    await db.batches.deleteMany({ where: { course_id: created.course } });
    await db.courses.delete({ where: { id: created.course } });
  }
  await db.users.deleteMany({ where: { id: { in: ids } } });
  for (const f of fixtures) await auth.deleteUser(f.uid);
  await db.$disconnect();
  console.log('Temporary exam/support fixtures removed');
}
