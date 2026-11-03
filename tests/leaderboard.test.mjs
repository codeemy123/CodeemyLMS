import test from 'node:test';
import assert from 'node:assert/strict';
import { batchLeaderboard } from '../src/lib/leaderboard.js';
import { renameWorkflow } from '../src/lib/workspace-renames.js';
const result = (student, score, extra = {}) => ({
  student,
  score,
  total: 100,
  title: 'Python exam',
  course: 'Python',
  batch: 'Python new',
  reason: 'submitted',
  ...extra,
});
const workflows = () => ({
  batches: {
    'Python new': { course: 'Python', students: ['Kavin Raj', 'Ananya', 'Rahul'] },
    'Python old': { course: 'Python', students: ['Kavin Raj', 'Other student'] },
  },
  assessmentResults: [],
  announcements: {},
});
test('leaderboard uses only the selected batch, course, assessment and enrolled roster', () => {
  const w = workflows();
  w.assessmentResults = [
    result('Kavin Raj', 70),
    result('Other student', 100),
    result('Kavin Raj', 99, { batch: 'Python old' }),
    result('Ananya', 98, { course: 'Java' }),
    result('Rahul', 95, { title: 'Other exam' }),
    result('Ananya', 94, { batch: undefined }),
  ];
  assert.deepEqual(
    batchLeaderboard(w, 'Python new', 'Python exam').map((r) => r.score),
    [70],
  );
  assert.deepEqual(batchLeaderboard(w, 'Python new', 'Python exam', 'Unassigned'), []);
});
test('leaderboard selects best completed attempt, normalises marks and gives tied scores equal rank', () => {
  const w = workflows();
  w.assessmentResults = [
    result('Kavin Raj', 40),
    result('Kavin Raj', 9, { total: 10 }),
    result('Ananya', 90),
    result('Rahul', 50),
    result('Rahul', 100, { reason: 'focus' }),
    result('Ananya', NaN),
    result('Rahul', 200),
    result('Rahul', 0, { total: 0 }),
  ];
  assert.deepEqual(
    batchLeaderboard(w, 'Python new', 'Python exam').map((r) => [r.student, r.rank, r.percent]),
    [
      ['Ananya', 1, 90],
      ['Kavin Raj', 1, 90],
      ['Rahul', 3, 50],
    ],
  );
});
test('renaming a batch preserves its leaderboard attribution', () => {
  const w = workflows();
  w.assessmentResults = [result('Kavin Raj', 80)];
  const renamed = renameWorkflow(w, 'Batches', 'Python new', 'Python November');
  assert.equal(batchLeaderboard(renamed, 'Python November', 'Python exam')[0].score, 80);
  assert.deepEqual(batchLeaderboard(renamed, 'Python new', 'Python exam'), []);
});
