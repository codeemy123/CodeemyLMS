import { test, expect } from './test-fixture';
import { initialWorkflows } from '../../src/data/mock/workflows.js';
import { initialCourses, initialRows, initialStudents } from '../../src/data/mock/lms.js';

test('mentor assessment settings and short-answer question reach student grading and mentor results', async ({
  page,
}) => {
  const path = '/assessments/javascript-fundamentals';
  await page.goto('/mentor' + path);
  await page.getByLabel('Duration (minutes)').fill('10');
  await page.getByLabel('Pass percentage').fill('70');
  await page.getByRole('button', { name: 'Save assessment settings' }).click();
  await page.getByLabel('Question type').selectOption('text');
  await page.getByLabel('Question prompt').fill('What does React use for component inputs?');
  await page.getByLabel('Expected answer').fill('Props');
  await page.getByLabel('Question marks').fill('5');
  await page.getByRole('button', { name: 'Save question', exact: true }).click();
  await expect(
    page.getByText('4. What does React use for component inputs?', { exact: true }),
  ).toBeVisible();
  await page.goto('/student' + path);
  await expect(page.getByText(/Duration: 10 minutes.*Questions: 4.*Pass score: 70%/)).toBeVisible();
  await page.getByRole('button', { name: 'Start assessment' }).click();
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole('radio')
      .nth(i === 1 ? 1 : 0)
      .check();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByLabel('Your answer', { exact: true }).fill('Props');
  await page.getByRole('button', { name: 'Submit assessment', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm submission' }).click();
  await expect(page.getByRole('heading', { name: '8 / 8', exact: true })).toBeVisible();
  await page.goto('/mentor' + path);
  await expect(page.locator('.task-row').filter({ hasText: 'Kavin Raj' })).toContainText('8/8');
});

test('mentor demo login/logout and every sidebar link navigate without browser errors', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/mentor/login');
  await page.getByLabel('Email address').fill('mentor@codeemy.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.auth-error')).toContainText('do not match');
  await page.getByRole('button', { name: 'Use demo account' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.banner')).toBeVisible();
  const links = await page
    .locator('.nav a')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href')));
  for (const href of links) {
    const link = page.locator(`.nav a[href="${href}"]`);
    await link.click();
    await expect(page).toHaveURL(href);
    await expect(link).toHaveClass(/active/);
    await expect(page.locator('.page-title h1')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/mentor/login');
  expect(errors).toEqual([]);
});

test('mentor performance, CSV, students and attendance contain only assigned records', async ({
  page,
}) => {
  const w = structuredClone(initialWorkflows);
  w.batches['Other web batch'] = {
    course: 'Full Stack Web Development',
    mentor: 'Priya Sharma',
    students: ['Kavin Raj', 'Meera Nair'],
  };
  w.assessmentResults = [
    {
      id: 'own',
      title: 'JavaScript fundamentals',
      student: 'Kavin Raj',
      score: 8,
      total: 10,
      passed: true,
      date: '2026-10-20',
    },
    {
      id: 'other',
      title: 'Design principles',
      student: 'Meera Nair',
      score: 0,
      total: 10,
      passed: false,
      date: '2026-10-20',
    },
  ];
  const records = {
    'attendance:Full Stack Web Development:FSWD · Sep 2026:2026-10-20:React components & props': {
      'Kavin Raj': 'Present',
    },
    'attendance:Full Stack Web Development:Other web batch:2026-10-20:React components & props': {
      'Kavin Raj': 'Absent',
    },
  };
  await page.addInitScript(
    (cache) => {
      if (!localStorage.getItem('codeemy-demo-v3'))
        localStorage.setItem('codeemy-demo-v3', JSON.stringify(cache));
    },
    {
      courses: initialCourses,
      students: initialStudents,
      mentors: ['Arjun Kumar', 'Priya Sharma', 'Rahul Verma'],
      baseRows: initialRows,
      records,
      workflows: w,
    },
  );
  await page.goto('/mentor/students');
  await expect(page.locator('tbody')).toContainText('Kavin Raj');
  await expect(page.locator('tbody')).not.toContainText('Meera Nair');
  await expect(page.getByRole('button', { name: 'Create Student', exact: true })).toHaveCount(0);
  await page.goto('/mentor/courses/full-stack-web-development');
  await expect(page.getByRole('button', { name: 'Mark complete', exact: true })).toHaveCount(0);
  await page.goto('/mentor/performance');
  await page.getByLabel('Report type').selectOption('Assessment');
  await expect(page.locator('tbody')).toContainText('JavaScript fundamentals');
  await expect(page.locator('tbody')).not.toContainText('Design principles');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Assessment CSV' }).click();
  const file = await download;
  const fs = await import('node:fs/promises');
  const csv = await fs.readFile(await file.path(), 'utf8');
  expect(csv).toContain('JavaScript fundamentals');
  expect(csv).not.toContain('Meera Nair');
  await page.getByLabel('Report type').selectOption('Batch');
  await expect(page.locator('tbody')).not.toContainText('Other web batch');
  await page.getByLabel('Report type').selectOption('Attendance');
  await expect(page.locator('tbody')).toContainText('Present');
  await expect(page.locator('tbody')).not.toContainText('Absent');
  await page.goto('/mentor/attendance');
  await expect(page.getByLabel('Batch').locator('option')).toHaveCount(1);
  await expect(page.getByLabel('Batch').locator('option')).not.toContainText(['Other web batch']);
});

test('mentor announcement to own batch reaches student and profile details persist', async ({
  page,
}) => {
  await page.goto('/mentor/announcements');
  await page.locator('tbody tr').first().getByRole('button', { name: 'View' }).click();
  await page.getByLabel('Audience', { exact: true }).selectOption('FSWD · Sep 2026');
  await page.getByLabel('Announcement message').fill('Prepare your portfolio for our next class.');
  await page.getByLabel('Publication status').selectOption('Published');
  await page.getByRole('button', { name: 'Save announcement' }).click();
  await page.goto('/student/notifications');
  await expect(page.getByText('Prepare your portfolio for our next class.')).toBeVisible();
  await page.goto('/mentor/notifications');
  await expect(page.getByText('Prepare your portfolio for our next class.')).toHaveCount(0);
  await page.goto('/mentor/profile');
  await page.getByLabel('Name', { exact: true }).fill('Arjun Kumar');
  await page.getByLabel('Email', { exact: true }).fill('mentor.preferences@example.com');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(
    'mentor.preferences@example.com',
  );
});
