import { test, expect } from './test-fixture';

test('admin keeps existing class course and date when editing a design class', async ({ page }) => {
  await page.goto('/admin/classes/designing-with-auto-layout');
  await page.getByRole('button', { name: 'Manage class' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Course', { exact: true })).toHaveValue(
    'UI/UX Design Fundamentals',
  );
  await expect(dialog.getByLabel('Deadline')).toHaveValue('2026-10-01');
  await dialog.getByLabel('Time', { exact: true }).fill('8:00 PM IST');
  await dialog.getByLabel('Meeting URL').fill('https://example.com/design-session');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/admin/classes');
  await expect(
    page.locator('tbody tr').filter({ hasText: 'Designing with auto layout' }),
  ).toContainText('UI/UX Design Fundamentals');
  await page.goto('/mentor/classes');
  await expect(page.locator('tbody')).not.toContainText('Designing with auto layout');
});

test('admin R2 image edits reach student and mentor, course reassignment removes access', async ({
  page: admin,
  context,
}) => {
  const student = await context.newPage(),
    mentor = await context.newPage();
  await admin.goto('/admin/content');
  await student.goto('/student/materials');
  await mentor.goto('/mentor/courses/full-stack-web-development');
  await admin.getByLabel('Resource title', { exact: true }).fill('Admin image guide');
  await admin.locator('input[name="file"]').setInputFiles({
    name: 'admin-guide.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await admin.getByRole('button', { name: 'Save learning resource' }).click();
  await expect(student.getByText('Admin image guide', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(mentor.getByText('Admin image guide', { exact: true })).toBeVisible();
  const row = admin.locator('.task-row').filter({ hasText: 'Admin image guide' });
  await row.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect
    .poll(() => admin.locator('.resource-image').evaluate((img) => img.naturalWidth))
    .toBe(1);
  const original = await row.getByRole('link', { name: 'Download file' }).getAttribute('href');
  await row.getByRole('button', { name: 'Edit resource' }).click();
  await admin.getByLabel('Resource title', { exact: true }).fill('Updated admin guide');
  await admin.getByRole('button', { name: 'Save learning resource' }).click();
  await expect(student.getByText('Updated admin guide', { exact: true })).toBeVisible();
  await expect(mentor.getByText('Updated admin guide', { exact: true })).toBeVisible();
  const updated = admin.locator('.task-row').filter({ hasText: 'Updated admin guide' });
  await expect(updated.getByRole('link', { name: 'Download file' })).toHaveAttribute(
    'href',
    original,
  );
  await updated.getByRole('button', { name: 'Edit resource' }).click();
  await admin.locator('select[name="course"]').selectOption('UI/UX Design Fundamentals');
  await admin.getByRole('button', { name: 'Save learning resource' }).click();
  await expect(student.getByText('Updated admin guide', { exact: true })).toHaveCount(0);
  await expect(mentor.getByText('Updated admin guide', { exact: true })).toHaveCount(0);
  await admin.reload();
  await expect(admin.getByText('Updated admin guide', { exact: true })).toBeVisible();
});

test('admin demo login and all sidebar pages navigate without browser errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/admin/login');
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.banner')).toBeVisible();
  const links = await page
    .locator('.nav a')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href')));
  for (const href of links) {
    await page.locator(`.nav a[href="${href}"]`).click();
    await expect(page).toHaveURL(href);
    await expect(page.locator('.page-title h1')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/admin/login');
  expect(errors).toEqual([]);
});
