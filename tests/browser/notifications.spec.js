import { test, expect } from './test-fixture';
import { initialWorkflows } from '../../src/data/mock/workflows.js';
import { initialCourses, initialRows, initialStudents } from '../../src/data/mock/lms.js';
test('all three notification inboxes separate delivery, links, unread state and new replies', async ({
  page,
}) => {
  const workflows = structuredClone(initialWorkflows);
  workflows.announcements = {
    'October assessment schedule': {
      body: 'Student-only schedule update',
      audience: 'All students',
      status: 'Published',
      history: [{ date: '2026-10-06' }],
    },
    'Mentor planning': {
      body: 'Mentor-only reminder',
      audience: 'All mentors',
      status: 'Published',
      history: [],
    },
  };
  workflows.submissions = [
    {
      id: 'test-s',
      title: 'Build a responsive portfolio',
      course: 'Full Stack Web Development',
      student: 'Kavin Raj',
      revision: 1,
      kind: 'Assignments',
      files: [],
      status: 'Submitted',
      notes: 'Notification test',
    },
    {
      id: 'pending-submission',
      title: 'Build a responsive portfolio',
      course: 'Full Stack Web Development',
      student: 'Kavin Raj',
      revision: 2,
      kind: 'Assignments',
      files: [],
      status: 'Submitted',
      notes: 'Pending review',
    },
  ];
  workflows.evaluations = {
    'test-s': [
      {
        date: '2026-10-06',
        feedback: 'Specific student feedback',
        marks: 88,
        decision: 'Approved',
      },
    ],
  };
  workflows.applications = [
    {
      id: 'test-a',
      title: initialRows.Career[0][0],
      student: 'Kavin Raj',
      status: 'Shortlisted',
      note: 'Applicant',
      resume: { data: 'data:text/plain,test', name: 'resume.txt' },
      history: [{ date: '2026-10-06', status: 'Shortlisted' }],
    },
  ];
  const cache = {
    courses: initialCourses,
    students: initialStudents,
    mentors: ['Arjun Kumar', 'Priya Sharma', 'Rahul Verma'],
    baseRows: initialRows,
    records: {},
    workflows,
  };
  await page.addInitScript((data) => {
    if (!localStorage.getItem('codeemy-demo-v3'))
      localStorage.setItem('codeemy-demo-v3', JSON.stringify(data));
  }, cache);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/student/notifications');
  await expect(page.getByText('Student-only schedule update')).toBeVisible();
  await expect(page.getByText('Mentor-only reminder')).toHaveCount(0);
  await expect(page.getByText('Specific student feedback')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Application Shortlisted:/ })).toBeVisible();
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible();
  await page.goto('/mentor/notifications');
  await expect(page.getByText('Student-only schedule update')).toHaveCount(0);
  await expect(page.getByText('Mentor-only reminder')).toBeVisible();
  const submission = page
    .locator('.task-row')
    .filter({ hasText: 'New submission: Build a responsive portfolio' });
  await expect(submission.getByText('New', { exact: true })).toBeVisible();
  await submission.getByRole('button', { name: 'View' }).click();
  await expect(page).toHaveURL('/mentor/assignments/build-a-responsive-portfolio');
  await page.goto('/admin/notifications');
  await expect(page.getByText('Student-only schedule update')).toHaveCount(0);
  await expect(page.getByText('Mentor-only reminder')).toHaveCount(0);
  await expect(page.getByText('Specific student feedback')).toHaveCount(0);
  const application = page.locator('.task-row').filter({ hasText: 'New application:' });
  await expect(application.getByText('New', { exact: true })).toBeVisible();
  await application.getByRole('button', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/admin\/career\/.+/);
  await page.goto('/student/notifications');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible();
  await page.evaluate(() => {
    const cache = JSON.parse(localStorage.getItem('codeemy-demo-v3'));
    cache.workflows.queries[0].replies.push({
      author: 'Arjun Kumar',
      message: 'A fresh mentor reply',
    });
    localStorage.setItem('codeemy-demo-v3', JSON.stringify(cache));
  });
  await page.reload();
  const reply = page.locator('.task-row').filter({ hasText: 'A fresh mentor reply' });
  await expect(reply.getByText('New', { exact: true })).toBeVisible();
  await reply.getByRole('button', { name: 'View' }).click();
  await expect(page).toHaveURL('/student/mentor');
  expect(errors).toEqual([]);
});

test('individual notification read state updates badges and stays separate across roles', async ({
  page,
}) => {
  await page.goto('/student/notifications');
  const first = page.locator('.task-row').first();
  await expect(first.getByText('New', { exact: true })).toBeVisible();
  const count = await page.locator('.task-row .badge').filter({ hasText: 'New' }).count();
  await first.getByRole('button', { name: 'Mark as read', exact: true }).click();
  await expect(first.getByText('New', { exact: true })).toHaveCount(0);
  await expect(page.locator('.task-row .badge').filter({ hasText: 'New' })).toHaveCount(count - 1);
  await page.reload();
  await expect(page.locator('.task-row').first().getByText('New', { exact: true })).toHaveCount(0);
  await page.goto('/mentor/notifications');
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await page.goto('/student/notifications');
  await expect(page.locator('.task-row .badge').filter({ hasText: 'New' })).toHaveCount(count - 1);
  const unseen = page
    .locator('.task-row')
    .filter({ has: page.getByText('New', { exact: true }) })
    .first();
  await unseen.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page).toHaveURL(/\/student\/(mentor|certificates)/);
  await page.goto('/student/notifications');
  await expect(page.locator('.task-row .badge').filter({ hasText: 'New' })).toHaveCount(count - 2);
});
