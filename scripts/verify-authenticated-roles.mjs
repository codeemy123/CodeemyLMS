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
  if (courses.length) await db.assignments.deleteMany({ where: { course_id: { in: courses } } });
  if (batch) await db.batches.delete({ where: { id: batch.id } });
  if (courses.length) await db.courses.deleteMany({ where: { id: { in: courses } } });
  if (users.length) {
    await db.audit_logs.deleteMany({ where: { user_id: { in: users.map((u) => u.id) } } });
    await db.audit_logs.deleteMany({
      where: { action: 'STUDENT_NUMBER_ALLOCATED', entity_id: { in: users.map((u) => u.id) } },
    });
    await db.users.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  }
  for (const uid of firebaseUsers) await auth.deleteUser(uid);
  await db.$disconnect();
  console.log('Integration test accounts and database records cleaned up.');
}
