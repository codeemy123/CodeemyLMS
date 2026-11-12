import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from '@playwright/test';
import { getPrisma } from '../src/lib/prisma.js';
import { r2Request } from '../src/lib/server/r2.js';
config({ path: ['.env.local', '.env'], quiet: true });
const origin = process.argv.includes('--live')
  ? 'https://lerno.codeemy.in'
  : 'http://127.0.0.1:3010';
const db = getPrisma(),
  fixtures = [];
const auth = getAuth(
  initializeApp(
    { projectId: 'codeemylms', credential: applicationDefault() },
    'profile-verification',
  ),
);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9i8AAAAASUVORK5CYII=',
  'base64',
);
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const role of ['STUDENT', 'MENTOR', 'ADMIN']) {
    const password = randomBytes(24).toString('base64url');
    const identity = await auth.createUser({
      email: 'profile-check-' + randomUUID() + '@example.com',
      password,
    });
    const fixture = { uid: identity.uid, keys: [] };
    fixtures.push(fixture);
    const user = await db.users.create({
      data: {
        firebase_uid: identity.uid,
        email: identity.email,
        full_name: 'Profile Test User',
        role,
        status: 'ACTIVE',
      },
    });
    fixture.id = user.id;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
      page = await context.newPage();
    page.setDefaultTimeout(20000);
    await page.goto(origin + '/login');
    await page.locator('input[autocomplete=username]').fill(identity.email);
    await page.locator('input[autocomplete=current-password]').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/' + role.toLowerCase() + '/dashboard', { timeout: 45000 });
    await page.goto(origin + '/' + role.toLowerCase() + '/profile');
    await page
      .getByRole('heading', { name: 'Personal details', exact: true })
      .waitFor({ timeout: 45000 });
    await page.getByLabel('Full name', { exact: true }).fill('Updated Profile Test');
    await page.getByLabel('Phone number').fill('9876543210');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page
      .getByRole('status')
      .filter({ hasText: 'Your personal details have been saved.' })
      .waitFor();
    const saved = await db.users.findUnique({ where: { id: user.id } });
    assert.equal(saved.full_name, 'Updated Profile Test');
    assert.equal(saved.phone, '9876543210');
    await page
      .getByLabel('Profile photo', { exact: true })
      .setInputFiles({ name: 'test-profile.png', mimeType: 'image/png', buffer: png });
    const uploadedResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/storage/upload') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Upload profile photo', exact: true }).click();
    const response = await uploadedResponse;
    const file = await response.json();
    if (file.key) fixture.keys.push(file.key);
    assert.equal(response.status(), 201, JSON.stringify(file));
    await page.getByRole('status').filter({ hasText: 'Profile photo updated.' }).waitFor();
    await page.reload();
    await page.locator('.profile-portrait img').waitFor();
    await page.waitForFunction(
      () => document.querySelector('.profile-portrait img')?.naturalWidth > 0,
    );
    const stored = await db.users.findUnique({ where: { id: user.id } });
    assert.ok(stored.profile_image);
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.querySelector('.content')).backgroundColor,
      ),
      'rgb(255, 255, 255)',
    );
    await page.screenshot({
      path: 'artifacts/profile-' + role.toLowerCase() + '-desktop.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({
      path: 'artifacts/profile-' + role.toLowerCase() + '-mobile.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Remove profile photo', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Profile photo removed.' }).waitFor();
    assert.equal((await db.users.findUnique({ where: { id: user.id } })).profile_image, null);
    console.log(
      'PASS ' +
        role +
        ': profile load, DB save, R2 upload/playback, reload, remove, white background, desktop/mobile',
    );
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  for (const fixture of fixtures.reverse()) {
    for (const key of fixture.keys) {
      const response = await r2Request('DELETE', key);
      assert.ok(response.ok || response.status === 404);
    }
    if (fixture.id) {
      await db.audit_logs.deleteMany({ where: { user_id: fixture.id, action: 'FILE_UPLOADED' } });
      await db.users.delete({ where: { id: fixture.id } });
    }
    await auth.deleteUser(fixture.uid);
  }
  await db.$disconnect();
  console.log('Temporary users and uploaded test files removed.');
}
