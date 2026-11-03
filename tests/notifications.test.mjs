import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceNotifications } from '../src/lib/notifications.js';
import { initialWorkflows } from '../src/data/mock/workflows.js';
import { workspaceHref } from '../src/lib/routes.js';
const sample = () => structuredClone(initialWorkflows);

test('admin receives only admin announcements and excludes its own publication', () => {
  const w = sample();
  w.announcements = {
    Admin: {
      audience: 'All admins',
      body: 'Needs review',
      status: 'Published',
      history: [{ author: 'Mentor', actorName: 'Arjun Kumar' }],
    },
    Own: {
      audience: 'All admins',
      body: 'My announcement',
      status: 'Published',
      history: [{ author: 'Admin', actorName: 'Academy Admin' }],
    },
  };
  assert.deepEqual(
    workspaceNotifications('Admin', w).map((n) => n.title),
    ['Admin'],
  );
  assert.ok(!workspaceNotifications('Student', w).some((n) => n.title === 'Admin'));
  assert.ok(!workspaceNotifications('Mentor', w).some((n) => n.title === 'Admin'));
  assert.deepEqual(workspaceNotifications('Unknown', w), []);
});

test('same student in different courses cannot route queries or submissions to the wrong TL', () => {
  const w = sample();
  w.batches['UXD · Sep 2026'].students.push('Kavin Raj');
  w.queries = [
    {
      id: 'private',
      student: 'Kavin Raj',
      course: 'UI/UX Design Fundamentals',
      title: 'Private design query',
      message: 'For Priya',
      status: 'Open',
      replies: [],
    },
  ];
  w.submissions = [
    {
      id: 'private',
      student: 'Kavin Raj',
      course: 'UI/UX Design Fundamentals',
      kind: 'Assignments',
      title: 'Design task',
    },
  ];
  assert.ok(!workspaceNotifications('Mentor', w).some((n) => n.id.includes('private')));
  const priya = workspaceNotifications('Mentor', w, {}, { mentor: 'Priya Sharma' });
  assert.ok(priya.some((n) => n.id.startsWith('query:')));
  assert.ok(priya.some((n) => n.id.startsWith('submission:')));
  delete w.queries[0].course;
  assert.ok(
    !workspaceNotifications('Mentor', w, {}, { mentor: 'Priya Sharma' }).some((n) =>
      n.id.startsWith('query:'),
    ),
  );
});

test('unrelated students and unassigned feedback do not enter the student inbox', () => {
  const w = sample();
  w.submissions = [
    {
      id: 'a',
      student: 'Ananya Iyer',
      course: 'Full Stack Web Development',
      kind: 'Assignments',
      title: 'Other student',
    },
    {
      id: 'b',
      student: 'Kavin Raj',
      course: 'UI/UX Design Fundamentals',
      kind: 'Assignments',
      title: 'Unassigned course',
    },
  ];
  w.evaluations = { a: [{ feedback: 'Private feedback' }], b: [{ feedback: 'Wrong course' }] };
  assert.ok(!workspaceNotifications('Student', w).some((n) => n.id.startsWith('evaluation:')));
  w.queries[0].replies.push({ author: 'Priya Sharma', message: 'Unrelated mentor' });
  assert.ok(!workspaceNotifications('Student', w).some((n) => n.id.startsWith('query:')));
});

test('student withdrawal notifies admin while avoiding a self-notification', () => {
  const w = sample();
  w.applications = [
    {
      id: 'a',
      student: 'Kavin Raj',
      title: 'Internship',
      status: 'Withdrawn',
      history: [{ actorRole: 'Student', status: 'Withdrawn', date: '2026-10-20' }],
    },
  ];
  assert.ok(
    !workspaceNotifications('Student', w).some((n) => n.id.startsWith('application-status:')),
  );
  assert.ok(
    workspaceNotifications('Admin', w).some((n) => n.title === 'Application withdrawn: Internship'),
  );
});

test('reviewed work disappears from TL pending alerts and a new revision creates a new alert', () => {
  const w = sample();
  w.submissions = [
    {
      id: 'r1',
      student: 'Kavin Raj',
      course: 'Full Stack Web Development',
      kind: 'Assignments',
      title: 'Portfolio',
      revision: 1,
    },
  ];
  assert.ok(workspaceNotifications('Mentor', w).some((n) => n.id === 'submission:r1'));
  w.evaluations.r1 = [{ marks: 88 }];
  assert.ok(!workspaceNotifications('Mentor', w).some((n) => n.id === 'submission:r1'));
  w.submissions.push({ ...w.submissions[0], id: 'r2', revision: 2 });
  assert.ok(workspaceNotifications('Mentor', w).some((n) => n.id === 'submission:r2'));
});
test('announcement delivery separates student, mentor, batch audiences and unpublished messages', () => {
  const w = sample();
  w.announcements = {
    Students: { audience: 'All students', body: 'Students', status: 'Published', history: [] },
    Mentors: { audience: 'All mentors', body: 'Mentors', status: 'Published', history: [] },
    Batch: { audience: 'FSWD · Sep 2026', body: 'Batch', status: 'Published', history: [] },
    Other: { audience: 'UXD · Sep 2026', body: 'Other', status: 'Published', history: [] },
    Draft: { audience: 'All students', body: 'Draft', status: 'Draft', history: [] },
  };
  const titles = (role) =>
    workspaceNotifications(role, w)
      .filter((n) => n.id.startsWith('announcement:'))
      .map((n) => n.title);
  assert.deepEqual(titles('Student'), ['Students', 'Batch']);
  assert.deepEqual(titles('Mentor'), ['Mentors', 'Batch']);
  assert.deepEqual(titles('Admin'), []);
});
test('queries notify the receiving side and never send admin to a mentor route', () => {
  const w = sample();
  w.queries = [
    {
      id: 'q',
      student: 'Kavin Raj',
      title: 'Help',
      message: 'Question',
      status: 'Open',
      replies: [],
    },
  ];
  assert.equal(
    workspaceNotifications('Mentor', w).filter((n) => n.id.startsWith('query:')).length,
    1,
  );
  assert.equal(
    workspaceNotifications('Admin', w).filter((n) => n.id.startsWith('query:')).length,
    0,
  );
  w.queries[0].replies = [{ author: 'Arjun Kumar', message: 'Answer' }];
  assert.equal(
    workspaceNotifications('Student', w).filter((n) => n.id.startsWith('query:')).length,
    1,
  );
  assert.equal(
    workspaceNotifications('Mentor', w).filter((n) => n.id.startsWith('query:')).length,
    0,
  );
  w.queries[0].replies.push({ author: 'Kavin Raj', message: 'Follow-up' });
  assert.equal(
    workspaceNotifications('Student', w).filter((n) => n.id.startsWith('query:')).length,
    0,
  );
  assert.equal(
    workspaceNotifications('Mentor', w).filter((n) => n.id.startsWith('query:')).length,
    1,
  );
});
test('submission, evaluation, application and certificate alerts are role specific with valid routes', () => {
  const w = sample();
  w.submissions = [
    {
      id: 's',
      student: 'Kavin Raj',
      kind: 'Assignments',
      title: 'Build a responsive portfolio',
      course: 'Full Stack Web Development',
      revision: 1,
    },
    {
      id: 'other',
      student: 'Meera Nair',
      kind: 'Assignments',
      title: 'Other',
      course: 'UI/UX Design Fundamentals',
      revision: 1,
    },
  ];
  w.evaluations.s = [{ date: '2026-10-06', feedback: 'Great' }];
  w.applications = [
    {
      id: 'a',
      title: 'Frontend internship',
      student: 'Kavin Raj',
      history: [{ date: '2026-10-06', status: 'Shortlisted' }],
    },
  ];
  const student = workspaceNotifications('Student', w),
    mentor = workspaceNotifications('Mentor', w),
    admin = workspaceNotifications('Admin', w);
  assert.ok(student.some((n) => n.id.startsWith('evaluation:')));
  assert.ok(student.some((n) => n.id.startsWith('application-status:')));
  assert.ok(student.some((n) => n.id.startsWith('certificate:')));
  assert.deepEqual(
    mentor.filter((n) => n.id.startsWith('submission:')).map((n) => n.id),
    [],
  );
  assert.ok(admin.some((n) => n.id === 'application:a'));
  assert.ok(!admin.some((n) => n.id.startsWith('evaluation:')));
  for (const [role, items] of [
    ['Student', student],
    ['Mentor', mentor],
    ['Admin', admin],
  ])
    for (const item of items)
      assert.doesNotThrow(() => workspaceHref(role, item.page, item.detail));
});
