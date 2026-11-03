import { test, expect } from './test-fixture';
import fs from 'node:fs';
import { roleRoutes } from '../../src/config/routes.js';

test('all three roles and their primary screens render without browser errors', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  fs.mkdirSync('artifacts', { recursive: true });
  for (const [role, sections] of Object.entries(roleRoutes)) {
    await page.goto(`/${role}/dashboard`);
    await expect(page.locator('.banner')).toBeVisible();
    await page.screenshot({ path: `artifacts/${role}-desktop.png`, fullPage: true });
    for (const section of Object.keys(sections)) {
      await page.goto(`/${role}/${section}`);
      if (section === 'login') {
        await expect(
          page.getByRole('heading', { name: 'Welcome back', exact: true }),
        ).toBeVisible();
        continue;
      }
      await expect(page.locator('.page-title h1')).toBeVisible();
      await expect(page.locator('.sidebar .role')).toHaveValue(
        role[0].toUpperCase() + role.slice(1),
      );
    }
  }
  expect(errors).toEqual([]);
});

test('assessment attempt can be answered and graded', async ({ page }) => {
  await page.goto('/student/assessments/javascript-fundamentals');
  await page.getByRole('button', { name: 'Start assessment' }).click();
  for (let index = 0; index < 3; index++) {
    await page
      .getByRole('radio')
      .nth(index === 1 ? 1 : 0)
      .check();
    if (index < 2) await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Submit assessment', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm submission' }).click();
  await expect(page.getByText('Assessment complete', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '3 / 3', exact: true })).toBeVisible();
});

test('attendance selections survive navigation inside the workspace', async ({ page }) => {
  await page.goto('/mentor/attendance');
  await page.getByLabel('Kavin Raj attendance').selectOption('Absent');
  await page.getByRole('button', { name: 'Save attendance' }).click();
  await page.locator('.nav').getByRole('link', { name: 'Courses', exact: true }).click();
  await page.locator('.nav').getByRole('link', { name: 'Attendance', exact: true }).click();
  await expect(page.getByLabel('Kavin Raj attendance')).toHaveValue('Absent');
});

test('audit detail is read-only and mobile dashboard has no horizontal overflow', async ({
  page,
}) => {
  await page.goto('/admin/audit-log/course-content-updated');
  await expect(page.getByText('Audit records cannot be edited from this preview.')).toBeVisible();
  await expect(page.getByText('Submit your work', { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/student/dashboard');
  await expect(page.locator('.banner')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/student-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/open/);
  await page.locator('.nav').getByRole('link', { name: 'My Courses', exact: true }).click();
  await expect(page).toHaveURL('/student/courses');
});
