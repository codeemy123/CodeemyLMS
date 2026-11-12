import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessmentDeadline,
  scoreChoice,
  publicQuestions,
} from '../src/lib/server/assessment-workflows.js';
test('server assessment deadline is capped by schedule end and independent of client time', () => {
  assert.equal(
    assessmentDeadline(
      { started_at: '2026-11-12T10:00:00Z' },
      { duration_minutes: 45, end_at: '2026-11-12T10:30:00Z' },
    ).toISOString(),
    '2026-11-12T10:30:00.000Z',
  );
});
test('choice grading requires the exact server answer set and hides correctness', () => {
  const q = {
    marks: 5,
    question_options: [
      { id: 'a', is_correct: true },
      { id: 'b', is_correct: false },
    ],
  };
  assert.equal(scoreChoice(q, ['a']), 5);
  assert.equal(scoreChoice(q, ['a', 'b']), 0);
  assert.equal(scoreChoice(q, []), 0);
  assert.equal(
    Object.hasOwn(publicQuestions({ questions: [q] })[0].question_options[0], 'is_correct'),
    false,
  );
});
