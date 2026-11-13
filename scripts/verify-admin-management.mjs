import { assertPortalRedirect } from './assert-portal-redirect.mjs';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getPrisma } from '../src/lib/prisma.js';
config({ path: ['.env.local', '.env'], quiet: true });
const origin =
  process.env.AUTH_TEST_ORIGIN ||
  (process.argv.includes('--live') ? 'https://lerno.codeemy.in' : 'http://127.0.0.1:3005');
if (
  !['127.0.0.1', 'localhost'].includes(new URL(origin).hostname) &&
  !(
    process.argv.includes('--live') &&
    new URL(origin).protocol === 'https:' &&
    [
      'codeemy-lms-796236466632.asia-south1.run.app',
      'codeemy-lms-ro3s2c3rda-el.a.run.app',
      'lerno.codeemy.in',
    ].includes(new URL(origin).hostname)
  )
)
  throw new Error('Local integration server required.');
const auth = getAuth(
  initializeApp(
    { projectId: process.env.FIREBASE_PROJECT_ID, credential: applicationDefault() },
    'role-integration',
  ),
);
const db = getPrisma(),
  marker = randomUUID(),
  users = [],
  firebaseUsers = [],
  cookies = {},
  files = [],
  courses = [];
let batch;
async function call(role, path, method = 'GET', body, extra = {}) {
  const headers = {
    ...(cookies[role] ? { cookie: cookies[role] } : {}),
    ...(method !== 'GET' ? { origin } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...extra,
  };
  const r = await fetch(origin + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  return r;
}
try {
  for (const role of ['ADMIN', 'MENTOR', 'STUDENT']) {
    const password = randomBytes(24).toString('base64url');
    const identity = await auth.createUser({
      email: 'lms-test-' + role.toLowerCase() + '-' + marker + '@example.com',
      password,
      displayName: 'LMS integration ' + role,
    });
    firebaseUsers.push(identity.uid);
    const user = await db.users.create({
      data: {
        firebase_uid: identity.uid,
        email: identity.email,
        full_name: identity.displayName,
        role,
      },
    });
    users.push(user);
    const signed = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
        process.env.FIREBASE_WEB_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity.email, password, returnSecureToken: true }),
      },
    );
    const token = await signed.json();
    assert.equal(signed.status, 200, 'Firebase password authentication');
    const session = await call(role, '/api/auth/session', 'POST', { idToken: token.idToken });
    assert.equal(session.status, 200, 'Session issuance ' + role);
    cookies[role] = session.headers.get('set-cookie').split(';')[0];
    assert.ok(cookies[role].startsWith('codeemy_session='));
    const me = await call(role, '/api/auth/me');
    assert.equal((await me.json()).user.id, user.id);
    for (const target of ['admin', 'mentor', 'student']) {
      const portal = await call(role, '/' + target + '/dashboard');
      if (target === role.toLowerCase()) assert.equal(portal.status, 200);
      else await assertPortalRedirect(portal, '/' + role.toLowerCase() + '/dashboard');
    }
  }
  console.log(
    'PASS real Firebase password login, HttpOnly sessions and portal authorization for all three roles',
  );
  const [admin, mentor, student] = users;
  const created = await call('ADMIN', '/api/courses', 'POST', {
    title: 'Integration ' + marker,
    slug: 'integration-' + marker,
    status: 'PUBLISHED',
    mentorId: mentor.id,
  });
  assert.equal(created.status, 200);
  const course = (await created.json()).course;
  courses.push(course.id);
  assert.equal((await call('MENTOR', '/api/courses', 'POST', { title: 'Denied' })).status, 403);
  assert.equal((await call('STUDENT', '/api/courses', 'POST', { title: 'Denied' })).status, 403);
  const batchResponse = await call('ADMIN', '/api/batches', 'POST', {
    name: 'Integration ' + marker,
    courseId: course.id,
    mentorId: mentor.id,
    studentIds: [student.id],
  });
  assert.equal(batchResponse.status, 200);
  batch = (await batchResponse.json()).batch;
  const sessionResponse = await call('ADMIN', '/api/class-sessions', 'POST', {
    batchId: batch.id,
    title: 'Integration class',
    startAt: new Date().toISOString(),
  });
  assert.equal(sessionResponse.status, 200);
  const session = (await sessionResponse.json()).session;
  assert.equal(
    (
      await call('MENTOR', '/api/class-sessions', 'POST', {
        batchId: batch.id,
        title: 'Denied',
        startAt: new Date().toISOString(),
      })
    ).status,
    403,
  );
  const list = await call('STUDENT', '/api/courses');
  assert.ok((await list.json()).courses.some((c) => c.id === course.id));
  const attendance = await call('MENTOR', '/api/attendance', 'POST', {
    sessionId: session.id,
    marks: [{ studentId: student.id, status: 'PRESENT' }],
  });
  assert.equal(attendance.status, 200);
  const denied = await call('STUDENT', '/api/attendance', 'POST', {
    sessionId: session.id,
    marks: [],
  });
  assert.equal(denied.status, 403);
  const createdAssignment = await call('ADMIN', '/api/assignments', 'POST', {
    title: 'Integration assignment',
    courseId: course.id,
    batchId: batch.id,
    totalMarks: 100,
  });
  assert.equal(createdAssignment.status, 200);
  const assignment = (await createdAssignment.json()).assignment;
  const submitted = await call(
    'STUDENT',
    '/api/assignments/' + assignment.id + '/submission',
    'POST',
    { submissionText: 'Integration test' },
  );
  assert.equal(submitted.status, 200);
  const submission = (await submitted.json()).submission;
  assert.equal(
    (
      await call('STUDENT', '/api/assignments/' + assignment.id + '/submission', 'POST', {
        submissionText: 'Duplicate',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call('MENTOR', '/api/submissions/' + submission.id + '/evaluation', 'POST', {
        marks: 87,
        feedback: 'Integration feedback',
      })
    ).status,
    200,
  );
  const notifications = await call('STUDENT', '/api/notifications');
  const inbox = await notifications.json();
  assert.ok(inbox.notifications.some((n) => n.type === 'ATTENDANCE'));
  assert.ok(inbox.notifications.some((n) => n.type === 'EVALUATION'));
  const mentorInbox = await call('MENTOR', '/api/notifications');
  assert.ok(!(await mentorInbox.json()).notifications.some((n) => n.user_id === student.id));
  assert.equal((await call('STUDENT', '/api/notifications', 'PATCH', { all: true })).status, 200);
  assert.equal(
    (
      await call('STUDENT', '/api/profile', 'PATCH', {
        fullName: 'Updated integration student',
        phone: '1234567890',
        role: 'ADMIN',
      })
    ).status,
    200,
  );
  const profile = await call('STUDENT', '/api/profile');
  const updated = (await profile.json()).user;
  assert.equal(updated.role, 'STUDENT');
  assert.equal(updated.full_name, 'Updated integration student');
  console.log(
    'PASS course assignment, attendance, grading, user-scoped notifications and profile persistence',
  );
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await fetch(origin + '/api/storage/upload', {
    method: 'POST',
    headers: {
      cookie: cookies.STUDENT,
      origin,
      'Content-Type': 'image/png',
      'x-file-name': 'integration.png',
      'Content-Length': String(png.length),
    },
    body: png,
  });
  assert.equal(upload.status, 201, 'R2 upload');
  const file = await upload.json();
  files.push(file.data);
  assert.equal((await call('STUDENT', file.data)).status, 200);
  assert.equal((await call('MENTOR', file.data)).status, 403);
  await db.assignment_submissions.update({
    where: { id: submission.id },
    data: { file_url: file.data },
  });
  assert.equal(
    (await call('MENTOR', file.data)).status,
    200,
    'Assigned mentor can read submitted attachment',
  );
  assert.equal((await call(null, file.data)).status, 401);
  assert.equal((await call('STUDENT', '/api/profile', 'PATCH', { photo: file.data })).status, 200);
  assert.equal((await call('STUDENT', '/api/profile', 'PATCH', { photo: null })).status, 200);
  for (const role of ['ADMIN', 'MENTOR', 'STUDENT'])
    assert.equal((await call(role, '/api/auth/session', 'DELETE')).status, 200);
  console.log('PASS private R2 upload/read authorization, profile picture save/removal and logout');
  // Isolated Admin CRUD checks; every referenced record belongs to this fixture.
  async function adminCreate(entity, body) {
    const r = await call('ADMIN', '/api/admin/records/' + entity, 'POST', body);
    assert.equal(r.status, 200, 'Admin create ' + entity);
    return (await r.json()).record;
  }
  async function adminEdit(entity, id, body) {
    const r = await call('ADMIN', '/api/admin/records/' + entity + '/' + id, 'PATCH', body);
    assert.equal(r.status, 200, 'Admin edit ' + entity);
    return (await r.json()).record;
  }
  async function adminRemove(entity, id) {
    const r = await call('ADMIN', '/api/admin/records/' + entity + '/' + id, 'DELETE');
    assert.equal(r.status, 200, 'Admin remove ' + entity);
  }
  assert.equal(
    (
      await call('MENTOR', '/api/admin/records/announcements', 'POST', {
        title: 'Denied',
        message: 'Denied',
      })
    ).status,
    403,
  );
  assert.equal(
    (await call('STUDENT', '/api/admin/records/courses/' + course.id, 'DELETE')).status,
    403,
  );
  assert.equal(
    (await call('ADMIN', '/api/admin/records/people/' + student.id, 'PATCH', { role: 'ADMIN' }))
      .status,
    400,
  );
  assert.equal(
    (await call('ADMIN', '/api/admin/records/people/' + admin.id, 'DELETE')).status,
    403,
  );
  assert.equal(
    (await call('ADMIN', '/api/admin/records/courses/' + course.id, 'DELETE')).status,
    409,
    'Linked course deletion must preserve history',
  );
  assert.equal(
    (await call('ADMIN', '/api/admin/records/assignments/' + assignment.id, 'DELETE')).status,
    409,
    'Submitted work must survive',
  );
  assert.equal(
    (await call('ADMIN', '/api/admin/records/classes/' + session.id, 'DELETE')).status,
    409,
    'Attendance history must survive',
  );
  assert.equal((await call('ADMIN', '/api/admin/records/audit_logs', 'POST', {})).status, 404);
  const notice = await adminCreate('announcements', {
    title: 'Test notice ' + marker,
    message: 'Original notice',
    course_id: course.id,
    batch_id: batch.id,
  });
  assert.equal(
    await db.notifications.count({ where: { reference_id: notice.id, user_id: student.id } }),
    1,
  );
  await adminEdit('announcements', notice.id, { message: 'Updated notice' });
  assert.equal(
    (await db.announcements.findUnique({ where: { id: notice.id } })).message,
    'Updated notice',
  );
  assert.equal(
    (await db.notifications.findFirst({ where: { reference_id: notice.id, user_id: student.id } }))
      .message,
    'Updated notice',
  );
  await adminRemove('announcements', notice.id);
  assert.equal(await db.announcements.findUnique({ where: { id: notice.id } }), null);
  assert.equal(await db.notifications.count({ where: { reference_id: notice.id } }), 0);
  const module = await adminCreate('modules', { title: 'Test module', course_id: course.id });
  const lesson = await adminCreate('lessons', { title: 'Test lesson', module_id: module.id });
  await adminEdit('lessons', lesson.id, { is_published: true, content: 'Updated lesson' });
  assert.equal((await db.lessons.findUnique({ where: { id: lesson.id } })).is_published, true);
  assert.equal(
    (await call('ADMIN', '/api/admin/records/modules/' + module.id, 'DELETE')).status,
    409,
  );
  await adminRemove('lessons', lesson.id);
  await adminRemove('modules', module.id);
  for (const [entity, body] of [
    [
      'resources',
      {
        title: 'Test resource',
        course_id: course.id,
        file_url: 'https://example.com/resource.pdf',
      },
    ],
    ['projects', { title: 'Test project', course_id: course.id }],
    ['assessments', { title: 'Test assessment', course_id: course.id, batch_id: batch.id }],
    [
      'classes',
      {
        title: 'Test removable class',
        batch_id: batch.id,
        mentor_id: mentor.id,
        start_at: new Date().toISOString(),
      },
    ],
    [
      'certificates',
      { student_id: student.id, course_id: course.id, certificate_number: 'TEST-' + marker },
    ],
  ]) {
    const record = await adminCreate(entity, body);
    if (entity === 'assessments') {
      const question = await adminCreate('questions', {
        assessment_id: record.id,
        question_text: 'Test question',
        question_type: 'MCQ',
      });
      const option = await adminCreate('options', {
        question_id: question.id,
        option_text: 'Test option',
        is_correct: true,
      });
      const attempt = await db.assessment_attempts.create({
        data: { assessment_id: record.id, student_id: student.id },
      });
      assert.equal(
        (
          await call('ADMIN', '/api/admin/records/questions/' + question.id, 'PATCH', {
            question_text: 'Must not change',
          })
        ).status,
        409,
      );
      assert.equal(
        (await call('ADMIN', '/api/admin/records/assessments/' + record.id, 'DELETE')).status,
        409,
      );
      await db.assessment_attempts.delete({ where: { id: attempt.id } });
      await adminEdit('options', option.id, { option_text: 'Updated option' });
      await adminRemove('options', option.id);
      await adminRemove('questions', question.id);
    } else if (entity !== 'certificates')
      await adminEdit(entity, record.id, { title: 'Updated ' + entity });
    await adminRemove(entity, record.id);
  }
  const career = await adminCreate('careers', {
    title: 'Test career',
    file_url: 'https://example.com/apply',
    course_id: course.id,
  });
  assert.equal(career.resource_type, 'CAREER');
  await adminEdit('careers', career.id, { title: 'Updated career' });
  await adminRemove('careers', career.id);
  assert.equal((await call('MENTOR', '/api/admin/audit')).status, 403);
  assert.equal((await call('ADMIN', '/api/admin/overview')).status, 200);
  const unused = await adminCreate('courses', { title: 'Unused ' + marker });
  courses.push(unused.id);
  await adminEdit('courses', unused.id, { description: 'Updated course' });
  await adminRemove('courses', unused.id);
  await adminEdit('people', student.id, { phone: '1112223334' });
  assert.equal((await db.users.findUnique({ where: { id: student.id } })).phone, '1112223334');
  await adminRemove('people', student.id);
  assert.equal((await call('STUDENT', '/api/auth/me')).status, 403);
  await adminEdit('people', student.id, { status: 'ACTIVE' });
  await adminEdit('people', mentor.id, {
    phone: '9998887776',
    full_name: 'LMS integration MENTOR',
  });
  assert.equal((await db.users.findUnique({ where: { id: mentor.id } })).phone, '9998887776');
  await adminRemove('people', mentor.id);
  assert.equal((await call('MENTOR', '/api/auth/me')).status, 403);
  await adminEdit('people', mentor.id, { status: 'ACTIVE' });
  console.log(
    'PASS Admin CRUD, targeted announcement updates/removal, protected history, user deactivation and forbidden role access',
  );

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const role of ['ADMIN', 'MENTOR', 'STUDENT']) {
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
      await page.goto(origin + '/' + role.toLowerCase() + '/courses');
      await page.getByRole('heading', { name: 'Integration ' + marker, exact: true }).waitFor();
      await page.goto(origin + '/' + role.toLowerCase() + '/profile');
      await page
        .getByRole('heading', {
          name: role === 'STUDENT' ? 'Updated integration student' : 'LMS integration ' + role,
          exact: true,
        })
        .waitFor();
      if (role === 'ADMIN') {
        const links = await page
          .locator('nav[aria-label="Admin navigation"] a')
          .evaluateAll((nodes) =>
            nodes.map((n) => ({ name: n.textContent.trim(), href: n.getAttribute('href') })),
          );
        const report = [];
        for (const link of links) {
          const errors = [];
          const onError = (e) => errors.push(e.name);
          page.on('pageerror', onError);
          const response = await page.goto(origin + link.href);
          await page.locator('main h1').waitFor();
          await page.waitForTimeout(150);
          report.push({
            page: link.name,
            status: response.status(),
            preview:
              (await page
                .getByText('This workflow is still a preview.', { exact: false })
                .count()) > 0,
            runtimeErrors: errors,
          });
          page.off('pageerror', onError);
          assert.equal(response.status(), 200, 'Admin page ' + link.name);
          assert.equal(errors.length, 0, 'Admin runtime ' + link.name);
        }
        fs.mkdirSync('artifacts', { recursive: true });
        fs.writeFileSync('artifacts/admin-page-audit.json', JSON.stringify(report, null, 2));
        console.log(
          'PASS Admin navigation audit: ' +
            report.length +
            ' pages; report saved to artifacts/admin-page-audit.json',
        );
      }
      if (role === 'ADMIN') {
        await page.goto(origin + '/admin/mentors');
        const mentorRole = page.locator('select[name="role"]');
        assert.equal(await mentorRole.inputValue(), 'MENTOR');
        assert.equal(await mentorRole.locator('option').count(), 1);
        await page.goto(origin + '/admin/students');
        const studentRole = page.getByLabel('Role', { exact: true });
        assert.equal(await studentRole.inputValue(), 'STUDENT');
        assert.equal(await studentRole.locator('option').count(), 1);
      }
      if (role === 'ADMIN') {
        await page.goto(origin + '/admin/announcements');
        await page.getByRole('button', { name: 'Create announcement', exact: true }).click();
        console.log('Admin browser announcement form opened');
        await page.getByLabel('Title', { exact: true }).fill('UI notice ' + marker);
        await page.getByLabel('Message', { exact: true }).fill('Original browser notice');
        await page.getByLabel('Course (optional)', { exact: true }).selectOption(course.id);
        await page.getByLabel('Batch (optional)', { exact: true }).selectOption(batch.id);
        console.log('Admin browser announcement fields selected');
        await page.getByRole('button', { name: 'Save announcement', exact: true }).click();
        await page.getByRole('heading', { name: 'UI notice ' + marker, exact: true }).waitFor();
        await page
          .getByRole('button', { name: 'Edit announcement: UI notice ' + marker, exact: true })
          .click();
        const dialog = page.getByRole('dialog', { name: 'Edit announcement', exact: true });
        await dialog.getByLabel('Message', { exact: true }).fill('Updated browser notice');
        await dialog.getByRole('button', { name: 'Save announcement', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        await page.getByText('Updated browser notice', { exact: true }).waitFor();
        await page
          .getByRole('button', { name: 'Remove announcement: UI notice ' + marker, exact: true })
          .click();
        await page.getByRole('button', { name: 'Confirm remove', exact: true }).click();
        await page
          .getByRole('heading', { name: 'UI notice ' + marker, exact: true })
          .waitFor({ state: 'hidden' });
        console.log('PASS Admin browser announcement create/edit/remove with confirmation');
      }
      await context.close();
    }
    console.log('PASS authenticated browser course and profile screens for three roles');
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(
    'FAIL',
    error.code || error.name,
    error instanceof assert.AssertionError
      ? error.message
      : 'Integration request failed; credentials omitted.',
  );
  process.exitCode = 1;
} finally {
  for (const path of files) {
    try {
      assert.equal((await call('STUDENT', path, 'DELETE')).status, 204);
    } catch {
      console.error('Test file cleanup failed');
      process.exitCode = 1;
    }
  }
  if (courses.length) {
    await db.assessments.deleteMany({ where: { course_id: { in: courses } } });
    await db.projects.deleteMany({ where: { course_id: { in: courses } } });
  }
  if (courses.length) await db.assignments.deleteMany({ where: { course_id: { in: courses } } });
  if (batch) await db.batches.delete({ where: { id: batch.id } });
  if (courses.length) await db.courses.deleteMany({ where: { id: { in: courses } } });
  if (users.length) {
    await db.audit_logs.deleteMany({ where: { user_id: { in: users.map((u) => u.id) } } });
    await db.users.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  }
  for (const uid of firebaseUsers) await auth.deleteUser(uid);
  await db.$disconnect();
  console.log('Integration test accounts and database records cleaned up.');
}
