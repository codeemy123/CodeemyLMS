import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from '@playwright/test';
import { getPrisma } from '../src/lib/prisma.js';

config({ path: ['.env.local', '.env'], quiet: true });
const origin = 'https://lerno.codeemy.in';
const db = getPrisma();
const auth = getAuth(
  initializeApp({ projectId: 'codeemylms', credential: applicationDefault() }, 'proxy-login-test'),
);
const created = [];
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const role of ['STUDENT', 'MENTOR', 'ADMIN']) {
    const password = randomBytes(24).toString('base64url');
    const identity = await auth.createUser({
      email: 'proxy-check-' + randomUUID() + '@example.com',
      password,
    });
    const fixture = { uid: identity.uid };
    created.push(fixture);
    const user = await db.users.create({
      data: {
        firebase_uid: identity.uid,
        email: identity.email,
        full_name: 'Temporary Proxy Check',
        role,
        status: 'ACTIVE',
      },
    });
    fixture.id = user.id;
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(origin + '/login');
    await page.locator('input[autocomplete="username"]').fill(identity.email);
    await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(origin + '/' + role.toLowerCase() + '/dashboard', { timeout: 45000 });
    const me = await context.request.get(origin + '/api/auth/me');
    assert.equal(me.status(), 200);
    assert.equal((await me.json()).user.role, role);
    const logout = await context.request.delete(origin + '/api/auth/session', {
      headers: { origin },
    });
    assert.equal(logout.status(), 200);
    assert.equal((await context.request.get(origin + '/api/auth/me')).status(), 401);
    console.log('PASS live mobile ' + role + ': email/password, dashboard, session, logout');
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  for (const fixture of created.reverse()) {
    if (fixture.id) await db.users.delete({ where: { id: fixture.id } });
    await auth.deleteUser(fixture.uid);
  }
  await db.$disconnect();
  console.log('Temporary test identities and database users removed.');
}
