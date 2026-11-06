import { config } from 'dotenv';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from '@playwright/test';
import { getPrisma } from '../src/lib/prisma.js';
import fs from 'node:fs';
config({ path: ['.env.local', '.env'], quiet: true });
const origin = 'http://127.0.0.1:3004';
const marker = randomUUID();
const emails = ['admin', 'student', 'mentor'].map(
  (role) => 'approval-test-' + role + '-' + marker + '@example.com',
);
const password = randomBytes(24).toString('base64url');
const auth = getAuth(
  initializeApp(
    { projectId: process.env.FIREBASE_PROJECT_ID, credential: applicationDefault() },
    'approval-tests',
  ),
);
const db = getPrisma();
let browser, adminCookie;
async function firebaseSignIn(email, signup = false) {
  const r = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:' +
      (signup ? 'signUp' : 'signInWithPassword') +
      '?key=' +
      process.env.FIREBASE_WEB_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  assert.equal(r.status, 200, 'Firebase test account auth');
  return r.json();
}
async function request(path, method = 'GET', body, token, cookie) {
  return fetch(origin + path, {
    method,
    redirect: 'manual',
    headers: {
      origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
try {
  const adminIdentity = await auth.createUser({ email: emails[0], password });
  await db.users.create({
    data: {
      firebase_uid: adminIdentity.uid,
      email: emails[0],
      full_name: 'Approval Test Admin',
      role: 'ADMIN',
    },
  });
  const adminToken = await firebaseSignIn(emails[0]);
  const login = await request('/api/auth/session', 'POST', { idToken: adminToken.idToken });
  assert.equal(login.status, 200);
  adminCookie = login.headers.get('set-cookie').split(';')[0];
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(origin + '/register');
  await page.getByLabel('Full name', { exact: true }).fill('Registration Student ' + marker);
  await page.getByLabel('Phone', { exact: true }).fill('9876543210');
  await page.getByLabel('Email address', { exact: true }).fill(emails[1]);
  await page.getByLabel('College / institution', { exact: true }).fill('Approval Test College');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Request academy access', exact: true }).click();
  await page.getByRole('heading', { name: 'Waiting for approval' }).waitFor({ timeout: 60000 });
  const student = await db.users.findUnique({ where: { email: emails[1] } });
  assert.equal(student.role, 'STUDENT');
  assert.equal(student.status, 'INACTIVE');
  const studentToken = await firebaseSignIn(emails[1]);
  const pending = await request('/api/auth/session', 'POST', { idToken: studentToken.idToken });
  assert.equal(pending.status, 403);
  assert.match((await pending.json()).error, /waiting for administrator approval/);
  assert.equal(
    (await request('/api/admin/approvals', 'GET', null, studentToken.idToken)).status,
    403,
  );
  const duplicate = await request('/api/auth/register', 'POST', {
    idToken: studentToken.idToken,
    fullName: 'Duplicate',
    role: 'STUDENT',
  });
  assert.equal(duplicate.status, 409);
  console.log(
    'PASS real browser Student registration persisted INACTIVE; pending access and duplicate requests blocked',
  );
  await context.addCookies([
    {
      name: 'codeemy_session',
      value: adminCookie.slice('codeemy_session='.length),
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto(origin + '/admin/approvals');
  await page.getByRole('textbox', { name: 'Search registrations' }).fill(emails[1]);
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByText('Approval Test College', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Approve account', exact: true }).click();
  await page
    .getByText('Account approved. The applicant can now sign in.', { exact: true })
    .waitFor({ timeout: 60000 });
  assert.equal((await db.users.findUnique({ where: { id: student.id } })).status, 'ACTIVE');
  const approved = await request('/api/auth/session', 'POST', { idToken: studentToken.idToken });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).role, 'STUDENT');
  const studentCookie = approved.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/student/dashboard', 'GET', null, null, studentCookie)).status, 200);
  assert.equal((await request('/admin/dashboard', 'GET', null, null, studentCookie)).status, 307);
  console.log(
    'PASS Admin browser review/approval activates only Student role; approved user can sign in',
  );
  const mentorToken = await firebaseSignIn(emails[2], true);
  const escalation = await request('/api/auth/register', 'POST', {
    idToken: mentorToken.idToken,
    fullName: 'Escalation',
    role: 'ADMIN',
  });
  assert.equal(escalation.status, 400);
  assert.equal(await db.users.findUnique({ where: { email: emails[2] } }), null);
  const mentorRegistration = await request('/api/auth/register', 'POST', {
    idToken: mentorToken.idToken,
    fullName: 'Registration Mentor ' + marker,
    role: 'MENTOR',
    phone: '9876543210',
    qualification: 'Python mentor',
    message: 'Review test',
  });
  assert.equal(mentorRegistration.status, 201);
  const mentorRequest = await mentorRegistration.json();
  const mentor = await db.users.findUnique({ where: { email: emails[2] } });
  assert.equal(mentor.status, 'INACTIVE');
  const emptyReject = await request(
    '/api/admin/approvals/' + mentorRequest.requestId,
    'POST',
    { decision: 'REJECTED', reason: '' },
    null,
    adminCookie,
  );
  assert.equal(emptyReject.status, 400);
  await page.reload();
  await page.getByRole('textbox', { name: 'Search registrations' }).fill(emails[2]);
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByText('Python mentor', { exact: true }).waitFor();
  fs.mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/account-approvals-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector('.sidebar').getBoundingClientRect().right <= 0,
  );
  await page.screenshot({ path: 'artifacts/account-approvals-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const rejected = await request(
    '/api/admin/approvals/' + mentorRequest.requestId,
    'POST',
    { decision: 'REJECTED', reason: 'Please provide verified teaching experience.' },
    null,
    adminCookie,
  );
  assert.equal(rejected.status, 200);
  const denied = await request('/api/auth/session', 'POST', { idToken: mentorToken.idToken });
  assert.equal(denied.status, 403);
  assert.match((await denied.json()).error, /verified teaching experience/);
  assert.equal((await db.users.findUnique({ where: { id: mentor.id } })).status, 'INACTIVE');
  assert.equal(
    (
      await request(
        '/api/admin/approvals/' + mentorRequest.requestId,
        'POST',
        { decision: 'APPROVED' },
        null,
        adminCookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        '/api/admin/approvals/' + mentorRequest.requestId,
        'POST',
        { decision: 'APPROVED' },
        studentToken.idToken,
      )
    ).status,
    403,
  );
  const list = await request('/api/admin/approvals', 'GET', null, null, adminCookie);
  const rows = (await list.json()).requests;
  assert.equal(rows.find((r) => r.user.email === emails[1]).status, 'APPROVED');
  assert.equal(rows.find((r) => r.user.email === emails[2]).status, 'REJECTED');
  const admin = await db.users.findUnique({ where: { email: emails[0] } });
  assert.ok(
    (await db.notifications.count({ where: { user_id: admin.id, type: 'ACCOUNT_APPROVAL' } })) >= 2,
  );
  console.log(
    'PASS Mentor rejection/reason, Admin-only decisions, no self-promotion, one-time review, Admin notifications and responsive review page',
  );
} catch (error) {
  console.error(
    'FAIL',
    error.name,
    error instanceof assert.AssertionError
      ? error.message
      : 'Registration test failed; credential details omitted.',
  );
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  const fixtures = await db.users.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = fixtures.map((u) => u.id);
  const records = await db.audit_logs.findMany({
    where: { entity_id: { in: ids }, action: 'REGISTRATION_REQUESTED' },
    select: { id: true },
  });
  await db.notifications.deleteMany({
    where: { OR: [{ user_id: { in: ids } }, { reference_id: { in: records.map((r) => r.id) } }] },
  });
  await db.audit_logs.deleteMany({
    where: { OR: [{ user_id: { in: ids } }, { entity_id: { in: ids } }] },
  });
  await db.users.deleteMany({ where: { id: { in: ids } } });
  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.deleteUser(user.uid);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
  }
  await db.$disconnect();
  console.log('Temporary approval-test accounts, requests and notifications removed.');
}
