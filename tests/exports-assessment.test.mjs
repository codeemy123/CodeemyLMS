import test from 'node:test';
import assert from 'node:assert/strict';
import { csvDocument, certificatePdf } from '../src/lib/exports.js';
import { gradeAssessment, gradeQuestion } from '../src/lib/assessment.js';
import { validateExternalUrl } from '../src/lib/urls.js';

test('external links reject executable and malformed URL schemes', () => {
  assert.equal(validateExternalUrl('https://example.com/lesson'), 'https://example.com/lesson');
  assert.equal(validateExternalUrl(''), '');
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///tmp/test',
    'not-a-url',
  ])
    assert.throws(() => validateExternalUrl(value));
});
test('grading supports weighted single-choice, multi-choice and short answers', () => {
  const q = [
    ['Single', ['A', 'B'], 1, 'single', 2],
    ['Multiple', ['A', 'B', 'C'], [0, 2], 'multiple', 3],
    ['Short', [], 'React', 'text', 5],
  ];
  assert.deepEqual(gradeAssessment(q, { 0: 1, 1: [2, 0], 2: ' react ' }, 60), {
    score: 10,
    total: 10,
    percent: 100,
    passed: true,
  });
  assert.equal(gradeQuestion(q[1], [0]), false);
  assert.equal(gradeQuestion(q[2], undefined), false);
  assert.equal(gradeAssessment(q, {}, 60).passed, false);
});
test('CSV escapes commas, quotes and spreadsheet formulas', () => {
  const csv = csvDocument(['Name'], [['A, B'], ['"quoted"'], ['=1+2']]);
  assert.ok(csv.includes('"A, B"'));
  assert.ok(csv.includes('""quoted""'));
  assert.ok(csv.includes("'=1+2"));
});
test('PDF cross references point to the correct objects and user text is escaped', () => {
  const pdf = certificatePdf({
    name: 'Kavin (Raj)',
    course: 'React\\Basics',
    number: 'CE-42',
    date: '2026-10-05',
  });
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.includes('Kavin \\(Raj\\)'));
  const start = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(start, start + 4), 'xref');
  pdf
    .match(/(\d{10}) 00000 n/g)
    .forEach((e, i) => assert.ok(pdf.slice(Number(e.slice(0, 10))).startsWith(`${i + 1} 0 obj`)));
});
