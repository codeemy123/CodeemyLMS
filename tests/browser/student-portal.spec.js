import { test, expect } from './test-fixture';

test('student demo rejects wrong password, signs in, toggles password and signs out', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/student/login');
  await page.getByLabel('Email address').fill('student@codeemy.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.auth-error')).toContainText('do not match');
  await expect(page).toHaveURL('/student/login');
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/student/dashboard');
  await expect(page.locator('.banner')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/student/login');
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('every student sidebar link navigates and shows the active screen', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/student/dashboard');
  await expect(page.locator('.banner')).toBeVisible();
  const links = await page
    .locator('.nav a')
    .evaluateAll((nodes) => nodes.map((node) => ({ href: node.getAttribute('href') })));
  for (const { href } of links) {
    const link = page.locator(`.nav a[href="${href}"]`);
    await link.click();
    await expect(page).toHaveURL(href);
    await expect(link).toHaveClass(/active/);
    await expect(page.locator('.page-title h1')).toBeVisible();
    await expect(page.locator('[aria-label="Loading saved workspace"]')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await expect(page).toHaveURL('/student/notifications');
  expect(errors).toEqual([]);
});

test('student login explicitly reports unconnected Google and password reset', async ({ page }) => {
  await page.goto('/student/login');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.locator('.auth-error')).toContainText('Password reset is not connected');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.locator('.auth-error')).toContainText('Google sign-in is not connected');
  // Document the existing demo boundary: logout has no server session to revoke.
  await page.goto('/student/dashboard');
  await expect(page.locator('.banner')).toBeVisible();
});
