import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceView } from '../src/lib/workspace-view.js';
import { renameWorkflow } from '../src/lib/workspace-renames.js';
import { initialCourses, initialRows, initialStudents } from '../src/data/mock/lms.js';
import { initialWorkflows } from '../src/data/mock/workflows.js';
test('admin batch changes determine student/TL courses, mentors and rosters', () => {
  const w = structuredClone(initialWorkflows);
  const view = (role) => workspaceView(role, initialCourses, initialStudents, initialRows, w);
  assert.ok(view('Student').courses.some((c) => c.title === 'Full Stack Web Development'));
  assert.ok(!view('Mentor').students.includes('Meera Nair'));
  w.batches['FSWD · Sep 2026'].mentor = 'Priya Sharma';
  assert.equal(
    view('Student').courses.find((c) => c.title === 'Full Stack Web Development').mentor,
    'Priya Sharma',
  );
  assert.ok(!view('Mentor').courses.some((c) => c.title === 'Full Stack Web Development'));
  w.batches['FSWD · Sep 2026'].students = [];
  assert.ok(!view('Student').courses.some((c) => c.title === 'Full Stack Web Development'));
  assert.equal(view('Admin').courses.length, initialCourses.length);
});
test('renamed courses retain linked batches, lessons, resources and eligibility', () => {
  const w = structuredClone(initialWorkflows),
    before = 'Full Stack Web Development',
    after = 'Web Engineering';
  w.courseContent[before] = [{ id: 'l1', title: 'Lesson' }];
  w.resources = [{ course: before, lesson: 'l1' }];
  w.opportunities.Job = { course: before };
  w.assessmentResults = [
    { title: 'Quiz', course: before, student: 'Kavin Raj', score: 8, total: 10 },
  ];
  const next = renameWorkflow(w, 'Courses', before, after);
  assert.deepEqual(next.courseContent[after], w.courseContent[before]);
  assert.equal(next.courseContent[before], undefined);
  assert.equal(next.batches['FSWD · Sep 2026'].course, after);
  assert.equal(next.resources[0].course, after);
  assert.equal(next.opportunities.Job.course, after);
  assert.equal(next.assessmentResults[0].course, after);
});
test('renamed assignment and batch preserve submission IDs and enrollment membership', () => {
  const w = structuredClone(initialWorkflows);
  w.submissions = [{ id: 's1', kind: 'Assignments', title: 'Portfolio' }];
  w.evaluations.s1 = [{ marks: 88 }];
  const next = renameWorkflow(w, 'Assignments', 'Portfolio', 'Accessible portfolio');
  assert.equal(next.submissions[0].title, 'Accessible portfolio');
  assert.equal(next.evaluations.s1[0].marks, 88);
  const renamed = renameWorkflow(w, 'Batches', 'FSWD · Sep 2026', 'October web batch');
  assert.ok(renamed.batches['October web batch'].students.includes('Kavin Raj'));
  assert.equal(renamed.batches['FSWD · Sep 2026'], undefined);
});
