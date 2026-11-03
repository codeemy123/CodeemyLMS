import { test, expect } from './test-fixture';
import fs from 'node:fs/promises';
test('queries and mentor replies survive refresh', async ({ page }) => {
  await page.goto('/student/mentor');
  await page.getByLabel('Subject').fill('Deployment help');
  await page.getByLabel('Your question').fill('How do I deploy my portfolio?');
  await page.getByRole('button', { name: 'Send query', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Deployment help' })).toBeVisible();
  await page.goto('/mentor/feedback');
  const thread = page.locator('article').filter({ hasText: 'Deployment help' });
  await thread.getByLabel('Reply').fill('Use your hosting preview URL.');
  await thread.getByRole('button', { name: 'Send reply' }).click();
  await page.goto('/student/mentor');
  await expect(page.getByText('Use your hosting preview URL.')).toBeVisible();
});
test('submission revisions and evaluation are scoped to the student', async ({ page }) => {
  const path = '/assignments/build-a-responsive-portfolio';
  await page.goto('/student' + path);
  await page.getByLabel('Submission file').setInputFiles({
    name: 'portfolio.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Source'),
  });
  await page.getByLabel('Submission notes').fill('First revision');
  await page.getByRole('button', { name: 'Submit assignment', exact: true }).click();
  await expect(page.getByText('Kavin Raj · Revision 1', { exact: true }).first()).toBeVisible();
  await page.goto('/mentor' + path);
  await page.getByRole('button', { name: 'Review Kavin Raj' }).click();
  await page.getByLabel('Marks / 100').fill('88');
  await page.getByLabel('Feedback', { exact: true }).fill('Great responsive work');
  await page.getByRole('button', { name: 'Save evaluation' }).click();
  await page.goto('/student' + path);
  await expect(page.getByText('Great responsive work').first()).toBeVisible();
  await page.getByLabel('Submission file').setInputFiles({
    name: 'portfolio-v2.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Revised'),
  });
  await page.getByLabel('Submission notes').fill('Second revision');
  await page.getByRole('button', { name: 'Submit assignment', exact: true }).click();
  await expect(page.getByText('Kavin Raj · Revision 2', { exact: true }).first()).toBeVisible();
});
test('mentor question edits appear in student assessment', async ({ page }) => {
  await page.goto('/mentor/assessments/javascript-fundamentals');
  await page.getByRole('button', { name: 'Edit question 1', exact: true }).click();
  await page.getByLabel('Question prompt').fill('Which method transforms each array element?');
  await page.getByRole('button', { name: 'Save question', exact: true }).click();
  await page.goto('/student/assessments/javascript-fundamentals');
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Which method transforms each array element?' }),
  ).toBeVisible();
});
test('batch assignments link profiles after refresh', async ({ page }) => {
  await page.goto('/admin/batches/fswd-sep-2026');
  await page.getByLabel('Mentor', { exact: true }).selectOption('Priya Sharma');
  await page.getByRole('checkbox', { name: 'Meera Nair', exact: true }).check();
  await page.getByRole('button', { name: 'Save assignments', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Meera Nair', exact: true })).toBeChecked();
  await page.goto('/admin/students/meera-nair');
  await expect(page.getByText('Full Stack Web Development · Mentor: Priya Sharma')).toBeVisible();
});
test('certificate revoke/reissue and PDF download work', async ({ page }) => {
  await page.goto('/admin/certificates/git-github-essentials');
  await page.getByLabel('Reason', { exact: true }).fill('Correction requested');
  await page.getByRole('button', { name: 'Revoke certificate' }).click();
  await page.getByLabel('Certificate verification ID').fill('CE-2026-00421');
  await page.getByRole('button', { name: 'Verify certificate' }).click();
  await expect(page.locator('.notice')).toContainText('Revoked');
  await page.getByRole('button', { name: 'Reissue certificate' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF certificate' }).click();
  const file = await pending;
  expect((await fs.readFile(await file.path())).toString().startsWith('%PDF-1.4')).toBe(true);
});
test('uploaded resources become available in the student course', async ({ page }) => {
  await page.goto('/mentor/courses/full-stack-web-development');
  await page.getByLabel('Resource title', { exact: true }).fill('React workbook');
  await page.getByLabel('Resource file').setInputFiles({
    name: 'workbook.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('React practice'),
  });
  await page.getByRole('button', { name: 'Add resource', exact: true }).click();
  await expect(page.getByText('React workbook', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.goto('/student/courses/full-stack-web-development');
  await expect(page.getByText('React workbook', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download', exact: true })).toBeVisible();
});
test('report CSV contains the selected filtered dataset', async ({ page }) => {
  await page.goto('/admin/reports');
  await page.getByLabel('Report type').selectOption('Student');
  await page.getByLabel('Filter report').fill('Kavin');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Student CSV' }).click();
  const file = await pending;
  const text = await fs.readFile(await file.path(), 'utf8');
  expect(text).toContain('Kavin Raj');
  expect(text).not.toContain('Ananya Iyer');
});

test('career eligibility and application status link student and admin', async ({ page }) => {
  await page.goto('/student/career');
  await page.locator('tbody tr').first().getByRole('button', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/student\/career\/.+/);
  const path = new URL(page.url()).pathname.replace('/student/', '/admin/');
  await page.goto(path);
  await page.getByLabel('Minimum completion %').fill('0');
  await page.getByLabel('Application deadline').fill('2099-12-31');
  await page.getByRole('button', { name: 'Save eligibility' }).click();
  await page.goto(path.replace('/admin/', '/student/'));
  await page.getByLabel('Resume').setInputFiles({
    name: 'resume.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 demo'),
  });
  await page.getByLabel('Application note').fill('Ready for my first internship');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByText('Ready for my first internship', { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.goto(path);
  await page.getByLabel('Application status').selectOption('Shortlisted');
  await page.getByRole('button', { name: 'Update application' }).click();
  await page.goto(path.replace('/admin/', '/student/'));
  await expect(page.getByText('Shortlisted', { exact: true }).first()).toBeVisible();
});

test('lesson edits and completion persist across refresh', async ({ page }) => {
  const path = '/courses/full-stack-web-development';
  await page.goto('/mentor' + path);
  await page.getByLabel('Module', { exact: true }).fill('Advanced React');
  await page.getByLabel('Lesson title').fill('Reusable hooks');
  await page.getByLabel('Lesson description').fill('Create and test a custom hook.');
  await page.getByRole('button', { name: 'Save lesson' }).click();
  await page.goto('/student' + path);
  await page.getByRole('button', { name: /Advanced React.*Reusable hooks/ }).click();
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.reload();
  await expect(page.getByText('1 / 5 complete', { exact: true })).toBeVisible();
});

test('published announcements respect audience and read status persists', async ({ page }) => {
  await page.goto('/admin/announcements');
  await page.locator('tbody tr').first().getByRole('button', { name: 'View' }).click();
  await page.getByLabel('Audience', { exact: true }).selectOption('All mentors');
  await page.getByLabel('Announcement message').fill('Mentor-only planning session');
  await page.getByLabel('Publication status').selectOption('Published');
  await page.getByRole('button', { name: 'Save announcement' }).click();
  await page.goto('/student/notifications');
  await expect(page.getByText('Mentor-only planning session')).toHaveCount(0);
  await page.goto('/mentor/notifications');
  await expect(page.getByText('Mentor-only planning session')).toBeVisible();
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible();
});
