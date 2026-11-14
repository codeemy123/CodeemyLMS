import { config } from 'dotenv';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chromium } from '@playwright/test';
import { getPrisma } from '../src/lib/prisma.js';
import { r2Request } from '../src/lib/server/r2.js';
import { encodeAnnouncement } from '../src/lib/announcement-content.js';
import { workflowRead } from '../src/lib/server/learning-workflows.js';
config({ path: ['.env.local', '.env'], quiet: true });
const origin = process.argv.includes('--live')
  ? 'https://lerno.codeemy.in'
  : 'http://127.0.0.1:3021';
const db = getPrisma(),
  auth = getAuth(
    initializeApp(
      { projectId: process.env.FIREBASE_PROJECT_ID, credential: applicationDefault() },
      'announcement-posters',
    ),
  );
const marker = randomUUID(),
  fixtures = [],
  cookies = {},
  pages = {},
  keys = [];
let browser, course, batch, announcementId;
async function request(who, path, method = 'GET', body) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      origin,
      cookie: 'codeemy_session=' + cookies[who],
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}
try {
  browser = await chromium.launch({ headless: true });
  for (const label of ['ADMIN', 'MENTOR', 'STUDENT', 'OTHER']) {
    const role = label === 'OTHER' ? 'STUDENT' : label,
      password = randomBytes(24).toString('base64url');
    const identity = await auth.createUser({
      email: 'poster-' + label + '-' + marker + '@example.com',
      password,
    });
    const fixture = { uid: identity.uid, label };
    fixtures.push(fixture);
    fixture.user = await db.users.create({
      data: {
        firebase_uid: identity.uid,
        email: identity.email,
        full_name: 'Poster ' + label,
        role,
        status: 'ACTIVE',
      },
    });
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
    cookies[label] = session.headers
      .get('set-cookie')
      .split(';')[0]
      .slice('codeemy_session='.length);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([
      {
        name: 'codeemy_session',
        value: cookies[label],
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    pages[label] = await context.newPage();
    pages[label].setDefaultTimeout(30000);
  }
  const actor = (label) => fixtures.find((f) => f.label === label).user;
  course = await db.courses.create({
    data: {
      title: 'Poster Course ' + marker,
      slug: marker,
      status: 'PUBLISHED',
      mentor_id: actor('MENTOR').id,
    },
  });
  batch = await db.batches.create({
    data: {
      name: 'Poster Batch ' + marker,
      course_id: course.id,
      mentor_id: actor('MENTOR').id,
      batch_members: { create: { student_id: actor('STUDENT').id } },
    },
  });
  const admin = pages.ADMIN;
  await admin.goto(origin + '/admin/announcements');
  await admin.getByRole('button', { name: 'Create announcement', exact: true }).click();
  await admin.getByLabel('Title', { exact: true }).fill('Poster Notice ' + marker);
  await admin.getByLabel('Course (optional)', { exact: true }).selectOption(course.id);
  await admin.getByLabel('Batch (optional)', { exact: true }).selectOption(batch.id);
  const image = await admin.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 1200;
    const x = c.getContext('2d');
    x.fillStyle = '#6042cb';
    x.fillRect(0, 0, 900, 1200);
    x.fillStyle = 'white';
    x.font = 'bold 64px sans-serif';
    x.fillText('CodeEmy Class Update', 60, 160);
    return c.toDataURL('image/png').split(',')[1];
  });
  const uploadResponse = admin.waitForResponse(
    (r) => r.url().endsWith('/api/storage/upload') && r.request().method() === 'POST',
  );
  await admin
    .getByLabel('Upload poster image', { exact: true })
    .setInputFiles({
      name: 'announcement.png',
      mimeType: 'image/png',
      buffer: Buffer.from(image, 'base64'),
    });
  const uploaded = await uploadResponse;
  assert.equal(uploaded.status(), 201);
  const file = await uploaded.json();
  keys.push(file.key);
  await admin.locator('.announcement-poster-preview').waitFor();
  assert.equal(
    (await request('STUDENT', file.data)).status,
    403,
    'Upload is private before publishing',
  );
  await admin.getByRole('button', { name: 'Save announcement', exact: true }).click();
  await admin.getByRole('heading', { name: 'Poster Notice ' + marker, exact: true }).waitFor();
  const saved = await db.announcements.findFirst({ where: { title: 'Poster Notice ' + marker } });
  assert.ok(saved);
  announcementId = saved.id;
  for (const label of ['STUDENT', 'MENTOR']) {
    const page = pages[label];
    await page.goto(origin + '/' + label.toLowerCase() + '/announcements');
    await page.getByRole('heading', { name: 'Poster Notice ' + marker, exact: true }).waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.announcement-poster img')].some(
        (i) => i.naturalWidth === 900,
      ),
    );
    assert.equal((await request(label, file.data)).status, 200);
    assert.equal(
      (await request(label, file.data, 'DELETE')).status,
      403,
      'Read permission does not grant file deletion',
    );
    const notifications = await (await request(label, '/api/notifications')).json();
    assert.ok(
      notifications.notifications.some(
        (n) => n.reference_id === announcementId && n.type === 'ANNOUNCEMENT',
      ),
    );
    await page.reload();
    await page.getByRole('heading', { name: 'Poster Notice ' + marker, exact: true }).waitFor();
    await page.waitForFunction(()=>[...document.querySelectorAll('.announcement-poster img')].some(i=>i.naturalWidth===900));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(
      () => document.querySelector('.sidebar').getBoundingClientRect().right <= 0,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({
      path: 'artifacts/poster-' + label.toLowerCase() + '-mobile.png',
      fullPage: true,
    });
  }
  const outsider = await (await request('OTHER', '/api/workflows/announcements')).json();
  assert.ok(!outsider.records.some((r) => r.id === announcementId));
  assert.equal((await request('OTHER', file.data)).status, 403);
  assert.equal(
    (
      await request('MENTOR', '/api/admin/records/announcements', 'POST', {
        title: 'Forbidden',
        message: 'Forbidden',
      })
    ).status,
    403,
  );
  const rollback = new Error('ROLLBACK_GLOBAL_POSTER_TEST');
  try {
    await db.$transaction(
      async (tx) => {
        const notice = await tx.announcements.create({
          data: {
            title: 'Global rollback ' + marker,
            message: encodeAnnouncement('', file.data),
            published_at: new Date(Date.now() - 1000),
          },
        });
        for (const label of ['STUDENT', 'MENTOR', 'OTHER'])
          assert.ok(
            (await workflowRead(tx, actor(label), 'announcements')).records.some(
              (r) => r.id === notice.id && r.image_url === file.data,
            ),
          );
        throw rollback;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    'PASS poster-only publish, R2 playback/reload, Student/Mentor notifications, academy-wide visibility (rolled back), batch isolation and forbidden file deletion',
  );
  await admin
    .getByRole('button', { name: 'Edit announcement: Poster Notice ' + marker, exact: true })
    .click();
  const dialog = admin.getByRole('dialog', { name: 'Edit announcement', exact: true });
  await dialog.getByLabel('Message', { exact: true }).fill('Updated text-only notice');
  await dialog.getByRole('button', { name: 'Remove poster', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save announcement', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await pages.STUDENT.reload();
  await pages.STUDENT.getByText('Updated text-only notice', { exact: true }).waitFor();
  assert.equal(
    (await request('STUDENT', file.data)).status,
    403,
    'Removing poster revokes audience access',
  );
  const after = await (await request('STUDENT', '/api/workflows/announcements')).json();
  assert.equal(after.records.find((r) => r.id === announcementId).image_url, null);
  const notices = await (await request('STUDENT', '/api/notifications')).json();
  assert.ok(
    notices.notifications.some(
      (n) => n.reference_id === announcementId && n.message === 'Updated text-only notice',
    ),
  );
  assert.equal(
    (await request('ADMIN', '/api/admin/records/announcements/' + announcementId, 'DELETE')).status,
    200,
  );
  assert.equal(await db.notifications.count({ where: { reference_id: announcementId } }), 0);
  console.log(
    'PASS Admin poster edit/removal, legacy text display, notification update, announcement deletion and responsive UI',
  );
} finally {
  if (browser) await browser.close();
  if (announcementId) {
    await db.notifications.deleteMany({ where: { reference_id: announcementId } });
    await db.announcements.deleteMany({ where: { id: announcementId } });
  }
  for (const key of keys) await r2Request('DELETE', key);
  if (batch) await db.batches.delete({ where: { id: batch.id } });
  if (course) await db.courses.delete({ where: { id: course.id } });
  for (const f of fixtures) {
    if (f.user) {
      await db.audit_logs.deleteMany({
        where: { OR: [{ user_id: f.user.id }, { entity_id: f.user.id }] },
      });
      await db.users.delete({ where: { id: f.user.id } });
    }
    await auth.deleteUser(f.uid);
  }
  await db.$disconnect();
  console.log('Temporary poster fixtures removed');
}
