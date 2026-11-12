import { test, expect } from '@playwright/test';
test('all role portals require a server session; forged cookies fail', async ({
  request,
  page,
  baseURL,
}) => {
  for (const role of ['student', 'mentor', 'admin']) {
    const response = await request.get('/' + role + '/dashboard', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain('/login');
    const forged = await request.get('/' + role + '/dashboard', {
      maxRedirects: 0,
      headers: { cookie: 'codeemy_session=forged', 'x-role': 'ADMIN' },
    });
    if (forged.status() === 307) expect(forged.headers().location).toContain('/login');
    else {
      expect(forged.status()).toBe(200);
      expect(await forged.text()).toMatch(/<meta[^>]*id="__next-page-redirect"[^>]*url=\/login"/);
    }
    await page.context().addCookies([{ name: 'codeemy_session', value: 'forged', url: baseURL }]);
    await page.goto('/' + role + '/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    const api = await request.get('/api/auth/me', {
      headers: { cookie: 'codeemy_session=forged', 'x-codeemy-workspace': role, 'x-role': 'ADMIN' },
    });
    expect(api.status()).toBe(401);
  }
});
test('login has real provider actions and no demo credentials', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByText('Use demo account')).toHaveCount(0);
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.locator('.auth-error')).toHaveText('Enter your email address first.');
});
test('account mapping denies anonymous requests; logout clears session', async ({
  request,
  baseURL,
}) => {
  const mapping = await request.post('/api/admin/accounts', {
    headers: { origin: baseURL },
    data: { firebaseUid: 'forged', role: 'ADMIN' },
  });
  expect(mapping.status()).toBe(401);
  const response = await request.delete('/api/auth/session', { headers: { origin: baseURL } });
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['set-cookie']).toContain('Max-Age=0');
});
