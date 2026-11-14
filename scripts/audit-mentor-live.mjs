import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { getPrisma } from '../src/lib/prisma.js';
config({ path: ['.env.local', '.env'], quiet: true });
const origin = 'https://lerno.codeemy.in',
  db = getPrisma(),
  report = [];
const auth = getAuth(
  initializeApp({ projectId: 'codeemylms', credential: applicationDefault() }, 'mentor-live-audit'),
);
const paths = [
  'dashboard',
  'students',
  'courses',
  'classes',
  'attendance',
  'assignments',
  'assessments',
  'projects',
  'performance',
  'feedback',
  'announcements',
  'notifications',
  'profile',
];
let identity, user, browser;
try {
  const password = randomBytes(24).toString('base64url');
  identity = await auth.createUser({
    email: 'mentor-audit-' + randomUUID() + '@example.com',
    password,
  });
  user = await db.users.create({
    data: {
      firebase_uid: identity.uid,
      email: identity.email,
      full_name: 'Temporary Mentor Audit',
      role: 'MENTOR',
      status: 'ACTIVE',
      created_at: new Date(identity.metadata.creationTime),
    },
  });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(origin + '/login');
  await page.locator('input[autocomplete=username]').fill(identity.email);
  await page.locator('input[autocomplete=current-password]').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/mentor/dashboard', { timeout: 45000 });
  let current;
  page.on('response', (r) => {
    if (current && r.url().startsWith(origin + '/api/') && r.status() >= 400)
      current.apiErrors.push({ path: new URL(r.url()).pathname, status: r.status() });
  });
  page.on('pageerror', (e) => {
    if (current) current.browserErrors.push(e.message.slice(0, 180));
  });
  for (const path of paths) {
    current = { page: path, apiErrors: [], browserErrors: [] };
    const response = await page.goto(origin + '/mentor/' + path);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    current.status = response.status();
    current.url = new URL(page.url()).pathname;
    current.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    current.alerts = await page.locator('[role=alert]').allTextContents();
    report.push(current);
    console.log(JSON.stringify(current));
  }
  for (const path of ['dashboard', 'assignments', 'profile']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + '/mentor/' + path);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    console.log(
      'MOBILE',
      path,
      'overflow:',
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    );
  }
  const blocked = await context.request.get(origin + '/api/admin/records/courses');
  assert.equal(blocked.status(), 403);
  console.log('Mentor admin API status:', blocked.status());
  const logout = await context.request.delete(origin + '/api/auth/session', {
    headers: { origin },
  });
  assert.equal(logout.status(), 200);
  assert.equal((await context.request.get(origin + '/api/auth/me')).status(), 401);
  console.log(
    'Logout status:',
    logout.status(),
    'after logout /me:',
    (await context.request.get(origin + '/api/auth/me')).status(),
  );
  writeFileSync('artifacts/mentor-live-audit.json', JSON.stringify(report, null, 2));
  for (const result of report) {
    assert.equal(result.status, 200, result.page);
    assert.equal(result.url, '/mentor/' + result.page);
    assert.deepEqual(result.apiErrors, [], result.page + ' API failures');
    assert.deepEqual(result.browserErrors, [], result.page + ' browser failures');
    assert.equal(result.overflow, false, result.page + ' horizontal overflow');
    assert.deepEqual(
      result.alerts.filter((text) => text.trim()),
      [],
      result.page + ' alerts',
    );
  }
} finally {
  if (browser) await browser.close();
  if (user) {
    await db.audit_logs.deleteMany({
      where: { action: 'STUDENT_NUMBER_ALLOCATED', entity_id: user.id },
    });
    await db.student_profiles.deleteMany({ where: { user_id: user.id } });
    await db.users.delete({ where: { id: user.id } });
  }
  if (identity) await auth.deleteUser(identity.uid);
  await db.$disconnect();
  console.log('Temporary audit account removed');
}
