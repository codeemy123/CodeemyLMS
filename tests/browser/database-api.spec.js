import { test, expect } from './test-fixture';
import fs from 'node:fs/promises';
test('admin backup downloads complete saved workflows without clearing browser data', async ({
  page,
}) => {
  await page.goto('/admin/dashboard');
  await expect(page.getByRole('button', { name: 'Download workspace backup' })).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('codeemy-demo-v3')));
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download workspace backup' }).click();
  const download = await downloadEvent;
  const backup = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  expect(backup.workspace).toEqual(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('codeemy-demo-v3')))).toEqual(
    before,
  );
});
test('database APIs reject anonymous callers and forged client role headers', async ({
  request,
}) => {
  for (const path of [
    '/api/auth/me',
    '/api/courses',
    '/api/class-sessions',
    '/api/notifications',
    '/api/submissions',
    '/api/attendance?sessionId=00000000-0000-4000-8000-000000000000',
  ]) {
    const response = await request.get(path, {
      headers: { 'x-role': 'ADMIN', 'x-user-id': '00000000-0000-4000-8000-000000000000' },
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Please sign in.' });
  }
});
test('database mutations reject cross-origin requests before checking data', async ({
  request,
}) => {
  for (const path of ['/api/courses', '/api/attendance', '/api/auth/session']) {
    const response = await request.post(path, {
      headers: { origin: 'https://other.example' },
      data: {},
    });
    expect(response.status()).toBe(403);
  }
});
