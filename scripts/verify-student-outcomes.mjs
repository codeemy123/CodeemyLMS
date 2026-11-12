import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from '@playwright/test';
import { getPrisma } from '../src/lib/prisma.js';
import { r2Request } from '../src/lib/server/r2.js';
config({ path: ['.env.local', '.env'], quiet: true });
const origin = 'https://lerno.codeemy.in',
  db = getPrisma(),
  fixtures = [],
  cookies = {},
  created = {};
const auth = getAuth(
  initializeApp({ projectId: 'codeemylms', credential: applicationDefault() }, 'outcomes-test'),
);
let browser;
async function call(role, path, method = 'GET', data) {
  const r = await fetch(origin + path, {
    method,
    headers: {
      origin,
      cookie: cookies[role],
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
try {
  for (const label of ['ADMIN', 'MENTOR', 'STUDENT', 'OTHER']) {
    const password = randomBytes(24).toString('base64url'),
      identity = await auth.createUser({
        email: 'outcome-check-' + randomUUID() + '@example.com',
        password,
      });
    const fixture = { uid: identity.uid };
    fixtures.push(fixture);
    const user = await db.users.create({
      data: {
        firebase_uid: identity.uid,
        email: identity.email,
        full_name: 'Temporary Outcome Check',
        role: label === 'OTHER' ? 'STUDENT' : label,
        status: 'ACTIVE',
      },
    });
    fixture.id = user.id;
    created[label] = user;
    const sign = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
        process.env.FIREBASE_WEB_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity.email, password, returnSecureToken: true }),
      },
    );
    assert.equal(sign.status, 200);
    const token = await sign.json();
    const session = await fetch(origin + '/api/auth/session', {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token.idToken }),
    });
    assert.equal(session.status, 200);
    cookies[label] = session.headers.get('set-cookie').split(';')[0];
  }
  const course = await db.courses.create({
    data: {
      title: 'Temporary outcomes course',
      slug: randomUUID(),
      status: 'PUBLISHED',
      mentor_id: created.MENTOR.id,
    },
  });
  created.course = course.id;
  const batch = await db.batches.create({
    data: { name: 'Temporary playback batch', course_id: course.id, mentor_id: created.MENTOR.id },
  });
  created.batch = batch.id;
  await db.batch_members.create({ data: { batch_id: batch.id, student_id: created.STUDENT.id } });
  const career = await db.resources.create({
    data: {
      course_id: course.id,
      title: 'Temporary career opportunity',
      resource_type: 'CAREER',
      file_url: 'https://example.com/career',
    },
  });
  created.career = career.id;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const studentContext = await browser.newContext();
  await studentContext.addCookies([
    { name: 'codeemy_session', value: cookies.STUDENT.slice(16), url: origin, httpOnly: true },
  ]);
  const page = await studentContext.newPage();
  page.setDefaultTimeout(25000);
  await page.goto(origin + '/student/career');
  const card = page.locator('article').filter({
    has: page.getByRole('heading', { name: 'Temporary career opportunity', exact: true }),
  });
  await card.getByLabel('Application note').fill('Temporary application');
  await card.getByRole('button', { name: 'Apply through academy' }).click();
  await card.getByText('APPLIED', { exact: true }).waitFor();
  const application = await db.career_applications.findUnique({
    where: { resource_id_student_id: { resource_id: career.id, student_id: created.STUDENT.id } },
  });
  assert.ok(application);
  assert.ok(
    [403, 404].includes((await call('OTHER', '/api/career', 'POST', { id: career.id })).status),
  );
  assert.equal(
    (
      await call('ADMIN', '/api/career', 'POST', {
        id: application.id,
        status: 'REVIEWING',
        feedback: 'Temporary review',
      })
    ).status,
    200,
  );
  await page.reload();
  await card.getByText('REVIEWING', { exact: true }).waitFor();
  await card.getByText('Temporary review', { exact: true }).waitFor();
  await card.getByRole('button', { name: 'Withdraw application' }).click();
  await card.getByText('WITHDRAWN', { exact: true }).waitFor();
  console.log(
    'PASS LIVE Career: browser apply, GCP persistence, Admin review/feedback, withdrawal, unrelated student denied',
  );
  const classroom = await db.class_sessions.create({
    data: {
      batch_id: batch.id,
      mentor_id: created.MENTOR.id,
      title: 'Temporary recorded class',
      start_at: new Date(),
    },
  });
  created.classroom = classroom.id;
  const mentorContext = await browser.newContext();
  await mentorContext.addCookies([
    { name: 'codeemy_session', value: cookies.MENTOR.slice(16), url: origin, httpOnly: true },
  ]);
  const mentorPage = await mentorContext.newPage();
  await mentorPage.goto(origin + '/mentor/classes');
  const upload = await mentorPage.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff983f';
    ctx.fillRect(0, 0, 160, 90);
    ctx.fillStyle = '#502617';
    ctx.font = '16px sans-serif';
    ctx.fillText('CodeEmy test', 20, 50);
    const stream = canvas.captureStream(10),
      chunks = [],
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start();
    const timer = setInterval(() => ctx.fillRect(0, 0, 1, 1), 100);
    await new Promise((r) => setTimeout(r, 2500));
    recorder.stop();
    await stopped;
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: 'video/webm' });
    const r = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'video/webm',
        'x-file-name': 'temporary-class.webm',
        'x-codeemy-upload': '1',
      },
      body: blob,
    });
    return { status: r.status, data: await r.json() };
  });
  assert.equal(upload.status, 201, JSON.stringify(upload.data));
  created.file = upload.data;
  const meeting = 'test-' + randomUUID();
  created.meeting = meeting;
  await db.zoom_class_links.create({ data: { meeting_uuid: meeting, class_id: classroom.id } });
  const recording = await db.zoom_recordings.create({
    data: {
      meeting_uuid: meeting,
      file_id: randomUUID(),
      status: 'READY',
      object_key: upload.data.key,
      size_bytes: BigInt(upload.data.size),
    },
  });
  const log = await db.audit_logs.findFirst({
    where: {
      user_id: created.MENTOR.id,
      action: 'FILE_UPLOADED',
      details: { path: ['key'], equals: upload.data.key },
    },
  });
  await db.audit_logs.update({
    where: { id: log.id },
    data: {
      entity_type: 'zoom_recording',
      entity_id: recording.id,
      details: { ...log.details, classId: classroom.id },
    },
  });
  await page.goto(origin + '/student/classes');
  const video = page.locator('video');
  await video.waitFor();
  await video.evaluate(async (v) => {
    v.muted = true;
    await v.play();
  });
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.1);
  await video.evaluate((v) => v.pause());
  assert.ok(
    [403, 404].includes(
      (await call('OTHER', '/api/class-recordings?classId=' + classroom.id)).status,
    ),
  );
  const forbidden = await fetch(origin + upload.data.data, { headers: { cookie: cookies.OTHER } });
  assert.ok([403, 404].includes(forbidden.status));
  const range = await fetch(origin + upload.data.data, {
    headers: { cookie: cookies.STUDENT, Range: 'bytes=0-15' },
  });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 16);
  console.log(
    'PASS LIVE recording playback: real WebM in R2 plays in Student class page, seeking/range works, unrelated student denied',
  );
  const module = await db.course_modules.create({
    data: { course_id: course.id, title: 'Temporary video module' },
  });
  const lesson = await db.lessons.create({
    data: {
      module_id: module.id,
      title: 'Temporary video lesson',
      is_published: true,
      video_url: upload.data.data,
    },
  });
  await page.goto(origin + '/student/progress?lesson=' + lesson.id);
  const lessonVideo = page.locator('video');
  await lessonVideo.waitFor();
  await lessonVideo.evaluate(async (v) => {
    v.muted = true;
    await v.play();
  });
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > 1.05);
  const savedPosition = page.waitForResponse(
    (r) => r.url().endsWith('/api/workflows/progress') && r.request().method() === 'POST',
  );
  await lessonVideo.evaluate((v) => v.pause());
  assert.equal((await savedPosition).status(), 200);
  assert.ok(
    (
      await db.lesson_progress.findUnique({
        where: { student_id_lesson_id: { student_id: created.STUDENT.id, lesson_id: lesson.id } },
      })
    ).last_position_seconds >= 1,
  );
  await page.reload();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime >= 1);
  console.log(
    'PASS LIVE lesson player: actual video plays, pause saves position to DB, reload resumes playback position',
  );
  const assignment = await db.assignments.create({
    data: {
      course_id: course.id,
      batch_id: batch.id,
      title: 'Temporary browser assignment',
      total_marks: 100,
    },
  });
  await page.goto(origin + '/student/assignments');
  await page.getByLabel('Your submission').fill('Temporary browser submission');
  await page.getByRole('button', { name: 'Submit assignment', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Assignment submitted.' }).waitFor();
  const submission = await db.assignment_submissions.findUnique({
    where: {
      assignment_id_student_id: { assignment_id: assignment.id, student_id: created.STUDENT.id },
    },
  });
  assert.equal(submission.submission_text, 'Temporary browser submission');
  assert.equal(
    (
      await call('MENTOR', '/api/submissions/' + submission.id + '/evaluation', 'POST', {
        marks: 91,
        feedback: 'Temporary browser feedback',
      })
    ).status,
    200,
  );
  await page.reload();
  await page.getByText('Temporary browser feedback', { exact: true }).waitFor();
  console.log(
    'PASS LIVE assignment browser: submit persists, mentor marks/feedback appear after refresh',
  );
  const exam = await db.assessments.create({
    data: {
      course_id: course.id,
      batch_id: batch.id,
      title: 'Temporary deadline exam',
      status: 'PUBLISHED',
      duration_minutes: 1,
      total_marks: 1,
      passing_marks: 1,
    },
  });
  created.exam = exam.id;
  const question = await db.questions.create({
    data: { assessment_id: exam.id, question_text: 'Test', question_type: 'MCQ', marks: 1 },
  });
  const option = await db.question_options.create({
    data: { question_id: question.id, option_text: 'Correct', is_correct: true },
  });
  await db.question_options.create({
    data: { question_id: question.id, option_text: 'Wrong', is_correct: false },
  });
  const started = await call('STUDENT', '/api/assessments/' + exam.id + '/attempt', 'POST');
  assert.equal(started.status, 200);
  await db.assessment_attempts.update({
    where: { id: started.data.attempt.id },
    data: { started_at: new Date(Date.now() - 120000) },
  });
  const late = await call(
    'STUDENT',
    '/api/assessment-attempts/' + started.data.attempt.id,
    'PATCH',
    { answers: [{ questionId: question.id, selectedOptionIds: [option.id] }] },
  );
  assert.equal(late.status, 200);
  assert.equal(late.data.attempt.status, 'EVALUATED');
  assert.equal(Number(late.data.attempt.score), 0);
  assert.equal(await db.answers.count({ where: { attempt_id: started.data.attempt.id } }), 0);
  console.log(
    'PASS LIVE exam deadline: expired attempt finalized by server and late answers cannot increase score',
  );
} finally {
  if (browser) await browser.close();
  const ids = fixtures.map((f) => f.id).filter(Boolean);
  if (created.exam) await db.assessments.delete({ where: { id: created.exam } });
  if (created.meeting) {
    await db.zoom_recordings.deleteMany({ where: { meeting_uuid: created.meeting } });
    await db.zoom_class_links.delete({ where: { meeting_uuid: created.meeting } });
  }
  if (created.file) {
    const r = await r2Request('DELETE', created.file.key);
    assert.ok(r.ok || r.status === 404);
  }
  if (created.career) {
    await db.notifications.deleteMany({ where: { reference_id: created.career } });
    await db.career_applications.deleteMany({ where: { resource_id: created.career } });
  }
  if (created.classroom)
    await db.notifications.deleteMany({ where: { reference_id: created.classroom } });
  await db.notifications.deleteMany({ where: { user_id: { in: ids } } });
  await db.audit_logs.deleteMany({
    where: {
      OR: [
        { user_id: { in: ids } },
        { action: 'STUDENT_NUMBER_ALLOCATED', entity_id: { in: ids } },
      ],
    },
  });
  if (created.batch) await db.batches.delete({ where: { id: created.batch } });
  if (created.course) await db.courses.delete({ where: { id: created.course } });
  await db.users.deleteMany({ where: { id: { in: ids } } });
  for (const fixture of fixtures) await auth.deleteUser(fixture.uid);
  await db.$disconnect();
  console.log('Temporary outcome fixtures and R2 video removed');
}
