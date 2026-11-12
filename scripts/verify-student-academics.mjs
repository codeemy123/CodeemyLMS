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
  : 'http://127.0.0.1:3011';
const db = getPrisma(),
  auth = getAuth(
    initializeApp(
      { projectId: 'codeemylms', credential: applicationDefault() },
      'academic-profile-check',
    ),
  );
let identity, user, browser;
try {
  const password = randomBytes(24).toString('base64url');
  identity = await auth.createUser({
    email: 'academics-check-' + randomUUID() + '@example.com',
    password,
  });
  user = await db.users.create({
    data: {
      firebase_uid: identity.uid,
      email: identity.email,
      full_name: 'Temporary Academic Check',
      role: 'STUDENT',
      status: 'ACTIVE',
      created_at: new Date(identity.metadata.creationTime),
    },
  });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(20000);
  await page.goto(origin + '/login');
  await page.locator('input[autocomplete=username]').fill(identity.email);
  await page.locator('input[autocomplete=current-password]').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/student/dashboard', { timeout: 45000 });
  await page.goto(origin + '/student/profile');
  await page.getByLabel('Department', { exact: true }).fill('Computer Science');
  assert.equal(
    await page.getByLabel('Registration number', { exact: true }).getAttribute('readonly'),
    '',
  );
  assert.match(
    await page.getByLabel('Registration number', { exact: true }).inputValue(),
    /^Codeemy\d{2,}$/,
  );
  await page.getByLabel('Admission date & time').waitFor();
  await page.getByLabel('College / institution').fill('CodeEmy Test Institution');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page
    .getByRole('status')
    .filter({ hasText: 'Your personal details have been saved.' })
    .waitFor();
  let profile = await db.student_profiles.findUnique({ where: { user_id: user.id } });
  assert.equal(profile.department, 'Computer Science');
  assert.equal(profile.college_name, 'CodeEmy Test Institution');
  assert.equal(
    profile.admission_date.getTime(),
    new Date(identity.metadata.creationTime).getTime(),
  );
  const originalNumber = profile.registration_number;
  await page.reload();
  await page.getByLabel('Department', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Department', { exact: true }).inputValue(),
    'Computer Science',
  );
  const patch = await page.context().request.patch(origin + '/api/profile', {
    headers: { origin },
    data: { department: 'Information Technology' },
  });
  assert.equal(patch.status(), 200);
  profile = await db.student_profiles.findUnique({ where: { user_id: user.id } });
  assert.equal(profile.department, 'Information Technology');
  assert.equal(profile.registration_number, originalNumber);
  assert.equal(profile.college_name, 'CodeEmy Test Institution');
  const invalid = await page.context().request.patch(origin + '/api/profile', {
    headers: { origin },
    data: { department: 'x'.repeat(151) },
  });
  assert.equal(invalid.status(), 400);
  const clear = await page
    .context()
    .request.patch(origin + '/api/profile', { headers: { origin }, data: { department: '' } });
  assert.equal(clear.status(), 200);
  assert.equal(
    (await db.student_profiles.findUnique({ where: { user_id: user.id } })).department,
    null,
  );
  console.log(
    'PASS: college/department persistence, immutable automatic Codeemy number, exact creation timestamp, reload, independent edits, validation and clearing',
  );
} finally {
  if (browser) await browser.close();
  if (user) {
    await db.audit_logs.deleteMany({
      where: { entity_id: user.id, action: 'STUDENT_NUMBER_ALLOCATED' },
    });
    await db.student_profiles.deleteMany({ where: { user_id: user.id } });
    await db.users.delete({ where: { id: user.id } });
  }
  if (identity) await auth.deleteUser(identity.uid);
  await db.$disconnect();
  console.log('Temporary student account removed');
}
