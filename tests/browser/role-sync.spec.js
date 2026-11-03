import { test, expect } from './test-fixture';

test('admin class edits reach student and TL attendance reaches student/admin reports', async ({
  page,
}) => {
  const path = '/classes/react-components-props';
  await page.goto('/admin' + path);
  await page.getByRole('button', { name: 'Manage class' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Deadline').fill('2026-11-01');
  await dialog.getByLabel('Time', { exact: true }).fill('7:00 PM IST');
  await dialog.getByLabel('Meeting URL').fill('https://example.com/class-preview');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/student' + path);
  await expect(page.getByRole('link', { name: 'Join class' })).toHaveAttribute(
    'href',
    'https://example.com/class-preview',
  );
  await expect(page.getByText(/2026-11-01.*7:00 PM IST/)).toBeVisible();
  await page.goto('/mentor/attendance');
  await page.getByLabel('Kavin Raj attendance').selectOption('Absent');
  await page.getByRole('button', { name: 'Save attendance' }).click();
  await page.goto('/student/progress');
  await page.getByLabel('Report type').selectOption('Attendance');
  await expect(page.locator('tbody tr').filter({ hasText: 'Kavin Raj' })).toContainText('Absent');
  await expect(page.locator('tbody')).not.toContainText('Ananya Iyer');
  await page.goto('/admin/reports');
  await page.getByLabel('Report type').selectOption('Attendance');
  await expect(page.locator('tbody tr').filter({ hasText: 'Kavin Raj' })).toContainText('Absent');
});

test('admin and TL updates reach open student/TL tabs without reloading', async ({
  context,
  page: admin,
}) => {
  const student = await context.newPage(),
    tl = await context.newPage();
  await admin.goto('/admin/batches/fswd-sep-2026');
  await student.goto('/student/courses');
  await tl.goto('/mentor/courses');
  await expect(
    student.getByRole('heading', { name: 'Full Stack Web Development', exact: true }),
  ).toBeVisible();
  await admin.getByLabel('Course', { exact: true }).selectOption('UI/UX Design Fundamentals');
  await admin.getByRole('button', { name: 'Save assignments' }).click();
  await expect(
    student.getByRole('heading', { name: 'UI/UX Design Fundamentals', exact: true }),
  ).toBeVisible();
  await expect(
    tl.getByRole('heading', { name: 'UI/UX Design Fundamentals', exact: true }),
  ).toBeVisible();
  await expect(
    student.getByRole('heading', { name: 'Full Stack Web Development', exact: true }),
  ).toHaveCount(0);
  await student.goto('/student/courses/ui-ux-design-fundamentals');
  await tl.goto('/mentor/courses/ui-ux-design-fundamentals');
  await tl.getByLabel('Module', { exact: true }).fill('Updated by TL');
  await tl.getByLabel('Lesson title').fill('Shared lesson');
  await tl.getByLabel('Lesson description').fill('Visible immediately in the student tab');
  await tl.getByRole('button', { name: 'Save lesson' }).click();
  await expect(student.getByRole('button', { name: /Updated by TL.*Shared lesson/ })).toBeVisible();
  await admin.goto('/admin/students/kavin-raj');
  await student.goto('/student/profile');
  await admin.getByRole('button', { name: 'Edit details' }).click();
  await admin.getByRole('dialog').getByLabel('Email').fill('live.updated@example.com');
  await admin.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(student.getByLabel('Email', { exact: true })).toHaveValue(
    'live.updated@example.com',
  );
});

test('admin creates and assigns a course, TL teaches it and student sees content and mentor changes', async ({
  page,
}) => {
  await page.goto('/admin/courses');
  await page.getByRole('button', { name: 'Create course', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('Modern web engineering');
  await dialog.getByLabel('Description').fill('A linked course for the academy.');
  await dialog.getByLabel('Mentor', { exact: true }).selectOption('Arjun Kumar');
  await dialog.getByLabel('Start date').fill('2026-10-06');
  await dialog.getByLabel('End date').fill('2026-12-31');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/student/courses');
  await expect(page.getByRole('heading', { name: 'Modern web engineering' })).toHaveCount(0);
  await page.goto('/admin/batches');
  await page.getByRole('button', { name: 'Create Batch' }).click();
  await dialog.getByLabel('Title', { exact: true }).fill('October engineering batch');
  await dialog.getByLabel('Course', { exact: true }).selectOption('Modern web engineering');
  await dialog.getByLabel('Mentor', { exact: true }).selectOption('Arjun Kumar');
  await dialog.getByLabel('Start date').fill('2026-10-06');
  await dialog.getByLabel('End date').fill('2026-12-31');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/admin/batches/october-engineering-batch');
  await page.getByRole('checkbox', { name: 'Kavin Raj', exact: true }).check();
  await page.getByRole('button', { name: 'Save assignments' }).click();
  await page.goto('/mentor/courses/modern-web-engineering');
  await page.getByLabel('Module', { exact: true }).fill('Foundations');
  await page.getByLabel('Lesson title').fill('Accessible components');
  await page.getByLabel('Lesson description').fill('Practice keyboard navigation.');
  await page.getByRole('button', { name: 'Save lesson' }).click();
  await page.goto('/student/courses/modern-web-engineering');
  await expect(page.getByText('Practice keyboard navigation.')).toBeVisible();
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.reload();
  await expect(page.getByText('1 / 1 complete', { exact: true })).toBeVisible();
  await page.goto('/admin/batches/october-engineering-batch');
  await page.getByLabel('Mentor', { exact: true }).selectOption('Priya Sharma');
  await page.getByRole('button', { name: 'Save assignments' }).click();
  await page.goto('/student/profile');
  await page.getByRole('button', { name: 'Academic details' }).click();
  await expect(page.getByText('Modern web engineering · Mentor: Priya Sharma')).toBeVisible();
  await page.goto('/mentor/courses');
  await expect(page.getByRole('heading', { name: 'Modern web engineering' })).toHaveCount(0);
  await page.goto('/mentor/courses/modern-web-engineering');
  await expect(page.getByRole('heading', { name: 'Not assigned to this workspace' })).toBeVisible();
});

test('admin brief edits, student submissions and TL marks propagate across renamed assignment', async ({
  page,
}) => {
  const path = '/assignments/build-a-responsive-portfolio';
  await page.goto('/admin' + path);
  await page.getByRole('button', { name: 'Edit brief' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Instructions').fill('Build a portfolio with accessible focus states.');
  await dialog.getByLabel('Deadline').fill('2026-11-20');
  await dialog.getByLabel('Max marks').fill('50');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/student' + path);
  await expect(page.getByText('Build a portfolio with accessible focus states.')).toBeVisible();
  await expect(page.getByText(/Due: 2026-11-20/)).toBeVisible();
  await page.getByLabel('Submission file').setInputFiles({
    name: 'source.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Portfolio source'),
  });
  await page.getByLabel('Submission notes').fill('My completed work');
  await page.getByRole('button', { name: 'Submit assignment', exact: true }).click();
  await expect(page.getByText('My completed work')).toBeVisible({ timeout: 30000 });
  await page.goto('/mentor' + path);
  await page.getByRole('button', { name: 'Review Kavin Raj' }).click();
  await page.getByLabel('Marks / 50').fill('44');
  await page.getByLabel('Feedback', { exact: true }).fill('Accessible and complete');
  await page.getByRole('button', { name: 'Save evaluation' }).click();
  await page.goto('/admin' + path);
  await page.getByRole('button', { name: 'Edit brief' }).click();
  await dialog.getByLabel('Title', { exact: true }).fill('Accessible portfolio');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/student/assignments/accessible-portfolio');
  await expect(page.getByText('My completed work')).toBeVisible();
  await expect(page.getByText('Accessible and complete').first()).toBeVisible();
  await expect(page.locator('.detail-copy > .badge')).toHaveText('Approved');
  await page.goto('/student/assignments');
  await expect(page.locator('tbody tr').filter({ hasText: 'Accessible portfolio' })).toContainText(
    '44 / 50',
  );
});

test('admin account edits appear in student profile and student edits appear in admin profile', async ({
  page,
}) => {
  await page.goto('/admin/students/kavin-raj');
  await page.getByRole('button', { name: 'Edit details' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill('kavin.updated@example.com');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/student/profile');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('kavin.updated@example.com');
  await page.getByLabel('Phone').fill('9000012345');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();
  await expect(page.getByLabel('Phone')).toHaveValue('9000012345');
  await page.goto('/admin/students/kavin-raj');
  await expect(page.getByText('Phone: 9000012345')).toBeVisible();
  await expect(page.getByText('kavin.updated@example.com')).toBeVisible();
});
