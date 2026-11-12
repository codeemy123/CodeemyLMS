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
  : 'http://127.0.0.1:3018';
const db = getPrisma(),
  fixtures = [];
const auth = getAuth(
  initializeApp(
    { projectId: 'codeemylms', credential: applicationDefault() },
    'profile-verification',
  ),
);
let png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9i8AAAAASUVORK5CYII=',
  'base64',
);
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const canvasPage = await browser.newPage();
  png = Buffer.from(
    await canvasPage.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#6552cc';
      ctx.fillRect(0, 0, 120, 600);
      ctx.fillStyle = '#b3dcff';
      ctx.fillRect(0, 240, 120, 120);
      return canvas.toDataURL('image/png').split(',')[1];
    }),
    'base64',
  );
  await canvasPage.close();
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
    assert.equal(await page.getByLabel('Full name', { exact: true }).getAttribute('readonly'), '');
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
    await page.getByLabel('Full name', { exact: true }).fill('Unsaved change');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(
      await page.getByLabel('Full name', { exact: true }).inputValue(),
      'Profile Test User',
    );
    assert.equal(
      (await db.users.findUnique({ where: { id: user.id } })).full_name,
      'Profile Test User',
    );
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
    await page.getByLabel('Full name', { exact: true }).fill('Updated Profile Test');
    await page.getByLabel('Phone number').fill('9876543210');
    if (role === 'STUDENT') {
      await page.getByLabel('College / institution').fill('Persistence Test College');
      await page.getByLabel('Department', { exact: true }).fill('Computer Science');
    }
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page
      .getByRole('status')
      .filter({ hasText: 'Your personal details have been saved.' })
      .waitFor();
    const saved = await db.users.findUnique({ where: { id: user.id } });
    assert.equal(saved.full_name, 'Updated Profile Test');
    assert.equal(saved.phone, '9876543210');
    assert.equal(await page.getByLabel('Full name', { exact: true }).getAttribute('readonly'), '');
    const uploadedResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/storage/upload') && r.request().method() === 'POST',
    );
    await page
      .getByLabel('Profile photo', { exact: true })
      .setInputFiles({ name: 'test-profile.png', mimeType: 'image/png', buffer: png });
    const response = await uploadedResponse;
    const file = await response.json();
    if (file.key) fixture.keys.push(file.key);
    assert.equal(response.status(), 201, JSON.stringify(file));
    await page.getByRole('status').filter({ hasText: 'Profile photo saved.' }).waitFor();
    await page.reload();
    await page.locator('.profile-portrait img').waitFor();
    await page.waitForFunction(
      () => document.querySelector('.profile-portrait img')?.naturalWidth > 0,
    );
    const stored = await db.users.findUnique({ where: { id: user.id } });
    assert.ok(stored.profile_image);
    await page.getByLabel('Full name', { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel('Full name', { exact: true }).inputValue(),
      'Updated Profile Test',
    );
    assert.equal(await page.getByLabel('Phone number').inputValue(), '9876543210');
    if (role === 'STUDENT') {
      assert.equal(
        await page.getByLabel('College / institution').inputValue(),
        'Persistence Test College',
      );
      assert.equal(
        await page.getByLabel('Department', { exact: true }).inputValue(),
        'Computer Science',
      );
    }
    const portrait = await page.locator('.profile-portrait > img').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height, fit: getComputedStyle(el).objectFit };
    });
    assert.equal(portrait.width, portrait.height, 'Tall images stay square before circular crop');
    assert.equal(portrait.fit, 'cover');
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
    await page.waitForFunction(
      () => document.querySelector('.sidebar').getBoundingClientRect().right <= 0,
    );
    const avatar = await page.locator('.profile-button img').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    assert.equal(avatar.width, avatar.height, 'Header avatar stays square');
    assert.ok(avatar.height <= 40, 'Header avatar cannot overflow');
    assert.ok(
      await page
        .locator('.sidebar .nav a')
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16),
    );
    const picker = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Change profile photo', exact: true }).click();
    await (await picker).setFiles([]);
    const bottom = page.getByRole('navigation', {
      name: role.charAt(0) + role.slice(1).toLowerCase() + ' quick navigation',
    });
    assert.equal(await bottom.getByRole('link').count(), 4);
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    assert.equal(await page.locator('html').getAttribute('data-workspace-theme'), 'dark');
    await page.reload();
    await page.getByRole('button', { name: 'Switch to light theme' }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-workspace-theme'), 'dark');
    await page.screenshot({
      path: 'artifacts/profile-' + role.toLowerCase() + '-dark.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await bottom.getByRole('link', { name: 'Home', exact: true }).click();
    await page.waitForURL('**/' + role.toLowerCase() + '/dashboard');
    await bottom
      .getByRole('link', { name: role === 'ADMIN' ? 'Courses' : 'Classes', exact: true })
      .click();
    await page.waitForURL(
      '**/' + role.toLowerCase() + '/' + (role === 'ADMIN' ? 'courses' : 'classes'),
    );
    await bottom.getByRole('link', { name: 'Profile', exact: true }).click();
    await page.waitForURL('**/' + role.toLowerCase() + '/profile');
    await page.getByRole('heading', { name: 'Personal details', exact: true }).waitFor();
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
    await page.reload();
    await page.getByRole('heading', { name: 'Personal details', exact: true }).waitFor();
    assert.equal(await page.locator('.profile-portrait img').count(), 0);
    await page.locator('.profile-signout-button').click();
    await page.waitForURL('**/login');
    assert.equal((await context.request.get(origin + '/api/auth/me')).status(), 401);
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
