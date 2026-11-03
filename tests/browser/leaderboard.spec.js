import { test, expect } from './test-fixture';
import { initialWorkflows } from '../../src/data/mock/workflows.js';
import { initialCourses, initialRows, initialStudents } from '../../src/data/mock/lms.js';

async function seed(page) {
  const w = structuredClone(initialWorkflows);
  w.batches['Python new'] = {
    course: 'Python for Data Science',
    mentor: 'Arjun Kumar',
    students: ['Kavin Raj', 'Ananya Iyer'],
  };
  w.batches['Python old'] = {
    course: 'Python for Data Science',
    mentor: 'Priya Sharma',
    students: ['Divya Suresh'],
  };
  const rows = structuredClone(initialRows);
  rows.Assessments.push([
    'Python basics',
    'Python for Data Science',
    '2026-11-10',
    'Upcoming',
    '3 questions',
  ]);
  const r = (
    student,
    score,
    batch,
    title = 'JavaScript fundamentals',
    course = 'Full Stack Web Development',
  ) => ({
    id: crypto.randomUUID(),
    student,
    score,
    total: 100,
    batch,
    title,
    course,
    reason: 'submitted',
    date: '2026-11-01T10:00:00Z',
  });
  const fs = Object.keys(w.batches)[0];
  w.assessmentResults = [
    r('Ananya Iyer', 95, fs),
    r('Kavin Raj', 70, fs),
    r('Kavin Raj', 80, fs),
    r('Rahul Menon', 50, fs),
    r('Divya Suresh', 100, 'Python old', 'Python basics', 'Python for Data Science'),
    r('Ananya Iyer', 88, 'Python new', 'Python basics', 'Python for Data Science'),
    r('Kavin Raj', 75, 'Python new', 'Python basics', 'Python for Data Science'),
  ];
  await page.addInitScript(
    (cache) => {
      if (!localStorage.getItem('codeemy-demo-v3'))
        localStorage.setItem('codeemy-demo-v3', JSON.stringify(cache));
    },
    {
      workflows: w,
      courses: initialCourses,
      baseRows: rows,
      students: initialStudents,
      mentors: ['Arjun Kumar', 'Priya Sharma', 'Rahul Verma'],
      records: {},
    },
  );
  return fs;
}

test('student leaderboard ranks the correct batch only and keeps Python batches separate', async ({
  page,
}) => {
  const fs = await seed(page);
  await page.goto('/student/leaderboard');
  await page.getByLabel('Leaderboard assessment').selectOption('JavaScript fundamentals');
  await expect(page.getByLabel('Leaderboard batch')).toHaveValue(fs);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Ananya Iyer');
  await expect(rows.nth(1)).toContainText('Kavin Raj (You)');
  await expect(rows.nth(1)).toContainText('80 / 100');
  await expect(rows.nth(2)).toContainText('Rahul Menon');
  await expect(page.getByLabel('Leaderboard batch').locator('option')).toHaveCount(2);
  await page.getByLabel('Leaderboard batch').selectOption('Python new');
  await expect(page.getByLabel('Leaderboard assessment')).toHaveValue('Python basics');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Ananya Iyer');
  await expect(rows.nth(0)).toContainText('88 / 100');
  await expect(page.locator('tbody')).not.toContainText('Divya Suresh');
  await page.reload();
  await page.getByLabel('Leaderboard batch').selectOption('Python new');
  await expect(rows).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('real assessment submission records its batch and appears on the leaderboard', async ({
  page,
}) => {
  await page.goto('/student/assessments/javascript-fundamentals');
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Submit assessment', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm submission', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Assessment complete', exact: true }),
  ).toBeVisible();
  await page
    .locator('.nav a')
    .filter({ hasText: /^Leaderboard$/ })
    .click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Kavin Raj (You)');
  await expect(page.locator('tbody tr')).toContainText('1 / 3');
});

test('student can choose the correct assessment batch when enrolled twice in one course', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/student/leaderboard');
  await page.evaluate(() => {
    const cache = JSON.parse(localStorage.getItem('codeemy-demo-v3'));
    cache.workflows.batches['Second web batch'] = {
      course: 'Full Stack Web Development',
      mentor: 'Arjun Kumar',
      students: ['Kavin Raj'],
    };
    localStorage.setItem('codeemy-demo-v3', JSON.stringify(cache));
  });
  await page.goto('/student/assessments/javascript-fundamentals');
  await page.getByLabel('Assessment batch').selectOption('Second web batch');
  await page.getByRole('button', { name: 'Start assessment', exact: true }).click();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Submit assessment', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm submission', exact: true }).click();
  await page.goto('/student/leaderboard');
  await page.getByLabel('Leaderboard batch').selectOption('Second web batch');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('1 / 3');
});
