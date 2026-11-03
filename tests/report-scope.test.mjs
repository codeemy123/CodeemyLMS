import test from 'node:test';
import assert from 'node:assert/strict';
import { reportScope } from '../src/lib/report-scope.js';
import { initialWorkflows } from '../src/data/mock/workflows.js';
import { initialRows } from '../src/data/mock/lms.js';
test('TL reports exclude other courses even when the student is shared', () => {
  const w = structuredClone(initialWorkflows);
  w.batches['UXD · Sep 2026'].students.push('Kavin Raj');
  w.assessmentResults = [
    { title: 'JavaScript fundamentals', student: 'Kavin Raj' },
    { title: 'Design principles', student: 'Kavin Raj' },
  ];
  w.submissions = [
    { id: 'a', kind: 'Projects', course: 'Full Stack Web Development', student: 'Kavin Raj' },
    { id: 'b', kind: 'Projects', course: 'UI/UX Design Fundamentals', student: 'Kavin Raj' },
  ];
  w.applications = [{ student: 'Kavin Raj', title: 'Internship' }];
  const scoped = reportScope('Mentor', w, initialRows, {}).workflows;
  assert.deepEqual(
    scoped.assessmentResults.map((r) => r.title),
    ['JavaScript fundamentals'],
  );
  assert.deepEqual(
    scoped.submissions.map((s) => s.id),
    ['a'],
  );
  assert.equal(scoped.applications.length, 0);
  assert.equal(Object.keys(scoped.batches).length, 1);
});
test('TL attendance reports cannot include another TL batch of the same course', () => {
  const w = structuredClone(initialWorkflows);
  w.batches.Other = {
    course: 'Full Stack Web Development',
    mentor: 'Priya Sharma',
    students: ['Kavin Raj'],
  };
  const own = 'attendance:Full Stack Web Development:FSWD · Sep 2026:2026-10-20:Class';
  const other = 'attendance:Full Stack Web Development:Other:2026-10-20:Class';
  const records = {
    [own]: { 'Kavin Raj': 'Present', 'Meera Nair': 'Absent' },
    [other]: { 'Kavin Raj': 'Absent' },
  };
  const mentor = reportScope('Mentor', w, initialRows, records);
  assert.deepEqual(Object.keys(mentor.records), [own]);
  assert.deepEqual(mentor.records[own], { 'Kavin Raj': 'Present' });
  const admin = reportScope('Admin', w, initialRows, records);
  assert.equal(admin.records, records);
  const student = reportScope('Student', w, initialRows, records);
  assert.equal(Object.keys(student.records).length, 2);
  assert.equal(student.records[own]['Meera Nair'], undefined);
});
