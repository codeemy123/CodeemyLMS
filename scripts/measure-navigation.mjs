import { config } from 'dotenv';
import { randomUUID, randomBytes } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { getPrisma } from '../src/lib/prisma.js';
config({ path: ['.env.local', '.env'], quiet: true });
const db = getPrisma(),
  origin = process.env.NAV_TEST_ORIGIN || 'https://lerno.codeemy.in',
  fixtures = [],
  report = [];
if (!['https://lerno.codeemy.in', 'http://127.0.0.1:3012'].includes(origin))
  throw Error('Unsupported test origin');
const auth = getAuth(
  initializeApp(
    { projectId: 'codeemylms', credential: applicationDefault() },
    'navigation-measure',
  ),
);
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const role of ['STUDENT', 'MENTOR', 'ADMIN']) {
    const password = randomBytes(24).toString('base64url'),
      identity = await auth.createUser({
        email: 'nav-check-' + randomUUID() + '@example.com',
        password,
      });
    const fixture = { uid: identity.uid };
    fixtures.push(fixture);
    const user = await db.users.create({
      data: {
        firebase_uid: identity.uid,
        email: identity.email,
        full_name: 'Temporary Navigation Check',
        role,
        status: 'ACTIVE',
      },
    });
    fixture.id = user.id;
    const sign = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
        process.env.FIREBASE_WEB_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity.email, password, returnSecureToken: true }),
      },
    );
    const token = await sign.json();
    const session = await fetch(origin + '/api/auth/session', {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token.idToken }),
    });
    if (session.status !== 200) throw Error('Session issue failed');
    const cookie = session.headers.get('set-cookie').split(';')[0];
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([
      { name: 'codeemy_session', value: cookie.slice(16), url: origin, httpOnly: true },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    let documents = 0;
    page.on('request', (r) => {
      if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documents++;
    });
    const first = Date.now();
    await page.goto(origin + '/' + role.toLowerCase() + '/dashboard');
    await page.locator('.nav').waitFor();
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    const initialMs = Date.now() - first;
    for (const [path, api] of [
      ['courses', '/api/courses'],
      ['assignments', '/api/assignments'],
      ['notifications', '/api/notifications'],
      ['profile', '/api/profile'],
    ]) {
      const href = '/' + role.toLowerCase() + '/' + path,
        link = page.locator('.sidebar a[href="' + href + '"]');
      await link.scrollIntoViewIfNeeded();
      const dataReady =
        path === 'notifications'
          ? null
          : page.waitForResponse(
              (r) => new URL(r.url()).pathname === api && r.request().method() === 'GET',
            );
      const start = Date.now();
      await link.click();
      await page.waitForURL(origin + href);
      const routeMs = Date.now() - start;
      const response = dataReady ? await dataReady : null;
      report.push({
        role,
        page: path,
        routeMs,
        dataMs: Date.now() - start,
        status: response?.status() || 200,
      });
      console.log(JSON.stringify(report.at(-1)));
    }
    console.log(JSON.stringify({ role, initialMs, documentLoads: documents }));
    await context.close();
  }
  writeFileSync(
    'artifacts/navigation-' + (process.env.NAV_REPORT_LABEL || 'baseline') + '.json',
    JSON.stringify(report, null, 2),
  );
} finally {
  if (browser) await browser.close();
  const ids = fixtures.map((f) => f.id).filter(Boolean);
  await db.audit_logs.deleteMany({
    where: { action: 'STUDENT_NUMBER_ALLOCATED', entity_id: { in: ids } },
  });
  await db.users.deleteMany({ where: { id: { in: ids } } });
  for (const f of fixtures) await auth.deleteUser(f.uid);
  await db.$disconnect();
  console.log('Temporary navigation accounts removed');
}
