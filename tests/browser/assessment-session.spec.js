import { test, expect } from './test-fixture';
const path = '/assessments/javascript-fundamentals';
async function configured(page, duration = '1') {
  await page.goto('/admin' + path);
  await page.getByLabel('Duration (minutes)').fill(duration);
  await page.getByLabel('Allowed attempts').fill('1');
  await page.getByRole('button', { name: 'Save assessment settings' }).click();
  await page.goto('/student' + path);
}
async function start(page) {
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await expect(page.getByText(/Time remaining:/)).toBeVisible();
}
async function record(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem('codeemy-demo-v3')).workflows.assessmentResults.at(-1),
  );
}

test('fullscreen permission rejection does not start the timer or consume an attempt', async ({
  page,
}) => {
  await configured(page);
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = () => Promise.reject(new Error('Denied'));
  });
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await expect(page.getByText('Allow fullscreen to start the assessment.')).toBeVisible();
  await expect(page.getByText(/Time remaining:/)).toHaveCount(0);
  expect(await record(page)).toBeUndefined();
});
test('admin duration drives absolute countdown; expiry closes submit dialog and locks a single saved attempt', async ({
  page,
}) => {
  await configured(page);
  const links = await page.locator('.nav a').allTextContents();
  expect(links.findIndex((s) => s.trim() === 'Assessments')).toBe(
    links.findIndex((s) => s.trim() === 'Assignments') + 1,
  );
  await page.clock.install();
  await start(page);
  await expect(page.getByText('Time remaining: 1:00', { exact: true })).toBeVisible();
  await page.getByRole('radio').first().check();
  await page.clock.fastForward(15000);
  await expect(page.getByText('Time remaining: 0:45', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Submit assessment', exact: true }).click();
  await page.clock.fastForward(45000);
  await expect(page.getByText('Assessment complete', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  expect((await record(page)).reason).toBe('timeout');
  expect((await record(page)).score).toBe(1);
  await page.getByRole('button', { name: 'Back to instructions' }).click();
  await expect(page.getByRole('button', { name: 'Start assessment', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start assessment', exact: true })).toBeDisabled();
});
for (const event of ['fullscreen', 'focus', 'hidden', 'resize', 'navigation', 'refresh']) {
  test(`${event} ends an attempt, preserves answers and consumes the configured attempt`, async ({
    page,
  }) => {
    await configured(page);
    await start(page);
    await page.getByRole('radio').first().check();
    if (event === 'fullscreen') await page.evaluate(() => document.exitFullscreen());
    if (event === 'focus') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    if (event === 'hidden')
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    if (event === 'resize') await page.setViewportSize({ width: 700, height: 650 });
    if (event === 'navigation')
      await page
        .locator('.nav a')
        .filter({ hasText: /^Assignments$/ })
        .click();
    if (event === 'refresh') await page.reload();
    await expect
      .poll(async () => (await record(page))?.reason)
      .toBe(event === 'refresh' ? 'interrupted' : event);
    expect((await record(page)).answers['0']).toBe(0);
    await page.goto('/student' + path);
    await expect(
      page.getByRole('button', { name: 'Start assessment', exact: true }),
    ).toBeDisabled();
    const count = await page.evaluate(
      () => JSON.parse(localStorage.getItem('codeemy-demo-v3')).workflows.assessmentResults.length,
    );
    expect(count).toBe(1);
    await page.goto('/admin' + path);
    await expect(page.locator('.task-row').filter({ hasText: 'Kavin Raj' })).toContainText('1/3');
  });
}
