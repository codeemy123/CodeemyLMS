import { config } from 'dotenv';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from '@playwright/test';
import { getPrisma } from '../src/lib/prisma.js';
config({ path: ['.env.local', '.env'], quiet: true });
const origin = 'http://127.0.0.1:3020',
  db = getPrisma();
const auth = getAuth(
  initializeApp(
    { projectId: process.env.FIREBASE_PROJECT_ID, credential: applicationDefault() },
    'class-ui',
  ),
);
const fixtures = [],
  cookies = {},
  marker = randomUUID();
let browser, course, batch;
try {
  for (const role of ['ADMIN', 'MENTOR', 'STUDENT']) {
    const password = randomBytes(24).toString('base64url');
    const identity = await auth.createUser({
      email: 'class-ui-' + role + '-' + marker + '@example.com',
      password,
    });
    const fixture = { uid: identity.uid, role };
    fixtures.push(fixture);
    const user = await db.users.create({
      data: {
        firebase_uid: identity.uid,
        email: identity.email,
        full_name: 'Class UI ' + role,
        role,
        status: 'ACTIVE',
      },
    });
    fixture.id = user.id;
    const signed = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
        process.env.FIREBASE_WEB_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity.email, password, returnSecureToken: true }),
      },
    );
    assert.equal(signed.status, 200);
    const token = await signed.json();
    const session = await fetch(origin + '/api/auth/session', {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token.idToken }),
    });
    assert.equal(session.status, 200);
    cookies[role] = session.headers
      .get('set-cookie')
      .split(';')[0]
      .slice('codeemy_session='.length);
  }
  browser = await chromium.launch({ headless: true });
  async function pageFor(role, width = 1440) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addCookies([
      {
        name: 'codeemy_session',
        value: cookies[role],
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    return page;
  }
  const mentorPage = await pageFor('MENTOR', 390);
  await mentorPage.goto(origin + '/mentor/attendance');
  await mentorPage.getByRole('heading', { name: 'No classes available yet' }).waitFor();
  assert.equal(
    await mentorPage.getByRole('button', { name: 'Save attendance', exact: true }).count(),
    0,
  );
  await mentorPage.screenshot({ path: 'artifacts/attendance-empty-mobile.png', fullPage: true });
  const mentor = fixtures.find((f) => f.role === 'MENTOR'),
    student = fixtures.find((f) => f.role === 'STUDENT');
  course = await db.courses.create({
    data: { title: 'UI Course ' + marker, slug: marker, status: 'PUBLISHED', mentor_id: mentor.id },
  });
  batch = await db.batches.create({
    data: {
      name: 'UI Batch ' + marker,
      course_id: course.id,
      mentor_id: mentor.id,
      batch_members: { create: { student_id: student.id } },
    },
  });
  const adminPage = await pageFor('ADMIN');
  await adminPage.goto(origin + '/admin/classes');
  await adminPage.getByLabel('Class title', { exact: true }).fill('UI Session ' + marker);
  await adminPage.getByLabel('Batch', { exact: true }).selectOption(batch.id);
  await adminPage.locator('input[name=startAt]').fill('2030-01-01T10:00');
  await adminPage.getByLabel('Meeting URL', { exact: true }).fill('https://example.com/meeting');
  await adminPage.getByRole('button', { name: 'Schedule class', exact: true }).click();
  await adminPage.getByRole('heading', { name: 'UI Session ' + marker, exact: true }).waitFor();
  const session = await db.class_sessions.findFirst({ where: { batch_id: batch.id } });
  assert.ok(session);
  for (const width of [1440, 390, 320]) {
    await adminPage.setViewportSize({ width, height: 900 });
    if (width < 900)
      await adminPage.waitForFunction(
        () => document.querySelector('.sidebar').getBoundingClientRect().right <= 0,
      );
    assert.equal(
      await adminPage.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await adminPage.screenshot({ path: 'artifacts/classes-' + width + '.png', fullPage: true });
  }
  await adminPage.goto(origin + '/admin/attendance');
  await adminPage.getByLabel('Class', { exact: true }).selectOption(session.id);
  const studentRow = adminPage
    .locator('.attendance-student')
    .filter({ hasText: 'Class UI STUDENT' });
  await studentRow.locator('select').selectOption('PRESENT');
  await adminPage.getByRole('button', { name: 'Save attendance', exact: true }).click();
  await adminPage.getByRole('status').filter({ hasText: 'Attendance saved.' }).waitFor();
  assert.equal(
    (await db.attendance.findFirst({ where: { session_id: session.id, student_id: student.id } }))
      .status,
    'PRESENT',
  );
  await adminPage.reload();
  await adminPage.getByLabel('Class', { exact: true }).selectOption(session.id);
  await adminPage.waitForFunction(
    () => document.querySelector('.attendance-student select')?.value === 'PRESENT',
  );
  for (const width of [1440, 390, 320]) {
    await adminPage.setViewportSize({ width, height: 900 });
    if (width < 900)
      await adminPage.waitForFunction(
        () => document.querySelector('.sidebar').getBoundingClientRect().right <= 0,
      );
    assert.equal(
      await adminPage.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await adminPage.screenshot({ path: 'artifacts/attendance-' + width + '.png', fullPage: true });
  }
  await mentorPage.reload();
  await mentorPage.getByLabel('Class', { exact: true }).selectOption(session.id);
  await mentorPage.waitForFunction(
    () => document.querySelector('.attendance-student select')?.value === 'PRESENT',
  );
  const studentPage = await pageFor('STUDENT', 390);
  await studentPage.goto(origin + '/student/classes');
  await studentPage.getByRole('heading', { name: 'UI Session ' + marker, exact: true }).waitFor();
  assert.equal(
    await studentPage.getByRole('button', { name: 'Schedule class', exact: true }).count(),
    0,
  );
  console.log(
    'PASS Admin class scheduling, Student/Mentor visibility, attendance save/reload, empty state and 320/390/1440px layouts',
  );
} finally {
  if (browser) await browser.close();
  if (batch) await db.batches.delete({ where: { id: batch.id } });
  if (course) await db.courses.delete({ where: { id: course.id } });
  for (const f of fixtures) {
    if (f.id) {
      await db.audit_logs.deleteMany({ where: { OR: [{ user_id: f.id }, { entity_id: f.id }] } });
      await db.users.delete({ where: { id: f.id } });
    }
    await auth.deleteUser(f.uid);
  }
  await db.$disconnect();
  console.log('Temporary class UI fixtures removed');
}
