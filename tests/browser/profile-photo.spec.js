import { test, expect } from './test-fixture';

for (const role of ['student', 'mentor']) {
  test(`${role} R2 profile photo persists and appears in admin account details`, async ({
    page,
  }) => {
    const name = role === 'student' ? 'Kavin Raj' : 'Arjun Kumar';
    await page.goto(`/${role}/profile`);
    if (role === 'student')
      await page.getByLabel('College name').fill('CodeEmy Engineering College');
    await page.getByLabel('Profile photo', { exact: true }).setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await page.getByRole('button', { name: 'Upload profile photo', exact: true }).click();
    const avatar = page.getByRole('img', { name: `${name} profile photo`, exact: true });
    await expect(avatar).toBeVisible({ timeout: 30000 });
    await expect.poll(() => avatar.evaluate((img) => img.naturalWidth)).toBe(1);
    const source = await avatar.getAttribute('src');
    expect(source).toMatch(/^\/api\/storage\/object\?/);
    await expect(
      page.getByRole('img', { name: 'Your profile picture', exact: true }),
    ).toHaveAttribute('src', source);
    await expect(avatar).toHaveCSS('border-radius', '50%');
    if (role === 'student')
      await expect(page.getByLabel('College name')).toHaveValue('CodeEmy Engineering College');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.reload();
    await expect(avatar).toHaveAttribute('src', source);
    if (role === 'student')
      await expect(page.getByLabel('College name')).toHaveValue('CodeEmy Engineering College');
    await page.goto(
      role === 'student' ? '/admin/students/kavin-raj' : '/admin/mentors/arjun-kumar',
    );
    await expect(avatar).toHaveAttribute('src', source);
    if (role === 'student')
      await expect(
        page.getByText('College: CodeEmy Engineering College', { exact: true }),
      ).toBeVisible();
    await page.goto(`/${role}/profile`);
    await page.getByRole('button', { name: 'Remove profile photo', exact: true }).click();
    await expect(avatar).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Your profile picture', exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator('.profile-photo-large')).toHaveText(role === 'student' ? 'KR' : 'AK');
    await page.reload();
    await expect(avatar).toHaveCount(0);
    if (role === 'student')
      await expect(page.getByLabel('College name')).toHaveValue('CodeEmy Engineering College');
  });
}

test('profile photo rejects documents without uploading', async ({ page }) => {
  let uploads = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/storage/upload') uploads++;
  });
  await page.goto('/student/profile');
  await page
    .getByLabel('Profile photo', { exact: true })
    .setInputFiles({ name: 'wrong.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
  await page.getByRole('button', { name: 'Upload profile photo', exact: true }).click();
  await expect(page.locator('.profile-photo-editor [role="alert"]')).toHaveText(
    'Choose a PNG, JPG, WebP or GIF image.',
  );
  expect(uploads).toBe(0);
});
