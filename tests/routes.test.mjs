import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { navigation } from '../src/config/navigation.js';
import { roleRoutes } from '../src/config/routes.js';
import { resolveWorkspaceRoute, toSlug, workspaceHref } from '../src/lib/routes.js';
import { initialCourses, initialRows, initialStudents } from '../src/data/mock/lms.js';

const resolve = (url) => resolveWorkspaceRoute(url, initialCourses, initialRows, initialStudents);

test('every role sidebar item has a real Next.js page and a clean URL', () => {
  for (const [role, links] of Object.entries(navigation)) {
    for (const [screen] of links) {
      const url = workspaceHref(role, screen);
      assert.equal(url.includes('#'), false);
      assert.ok(url.startsWith(`/${role.toLowerCase()}/`));
      assert.ok(
        fs.existsSync(path.join('src/app/(workspace)', url, 'page.js')),
        `Missing route for ${role}: ${screen}`,
      );
      assert.equal(resolve(url).role, role);
      assert.equal(resolve(url).page, screen);
    }
  }
});

test('every configured section has its own page file and every role has a layout', () => {
  for (const [role, sections] of Object.entries(roleRoutes)) {
    assert.ok(fs.existsSync(`src/app/(workspace)/${role}/layout.js`));
    for (const section of Object.keys(sections)) {
      assert.ok(fs.existsSync(`src/app/(workspace)/${role}/${section}/page.js`));
    }
  }
});

test('course detail links resolve after a direct URL visit for all three roles', () => {
  for (const role of Object.keys(navigation)) {
    const page = role === 'Student' ? 'My Courses' : 'Courses';
    for (const course of initialCourses) {
      assert.deepEqual(resolve(workspaceHref(role, page, course)).detail, course);
      assert.ok(fs.existsSync(`src/app/(workspace)/${role.toLowerCase()}/courses/[id]/page.js`));
    }
  }
});

test('submission, certificate and opportunity detail routes recover the complete mock row', () => {
  for (const page of ['Assignments', 'Assessments', 'Projects', 'Certificates', 'Career']) {
    for (const row of initialRows[page]) {
      assert.deepEqual(resolve(workspaceHref('Student', page, { title: row[0] })).detail, {
        title: row[0],
        row,
      });
    }
  }
});

test('student and mentor detail URLs resolve the correct person', () => {
  assert.equal(resolve('/mentor/students/kavin-raj').detail.title, 'Kavin Raj');
  assert.equal(resolve('/admin/mentors/arjun-kumar').detail.title, 'Arjun Kumar');
});

test('newly created mock mentors resolve without falling back to the original roster', () => {
  const result = resolveWorkspaceRoute(
    '/admin/mentors/new-mentor',
    initialCourses,
    initialRows,
    initialStudents,
    ['New Mentor'],
  );
  assert.equal(result.detail.title, 'New Mentor');
  assert.equal(result.detail.missing, undefined);
});

test('missing records are marked missing instead of opening an unrelated course', () => {
  assert.equal(resolve('/student/courses/missing-course').detail.missing, true);
  assert.equal(resolve('/student/assignments/missing-assignment').detail.missing, true);
});

test('unknown roles/pages are rejected when constructing links', () => {
  assert.throws(() => workspaceHref('Teacher', 'Dashboard'), /Unknown role/);
  assert.throws(() => workspaceHref('Student', 'Students'), /Unknown Student page/);
});

test('mock IDs remove spaces, slashes and punctuation from readable titles', () => {
  assert.equal(toSlug(' UI/UX Design Fundamentals '), 'ui-ux-design-fundamentals');
  assert.equal(toSlug('Git & GitHub Essentials'), 'git-github-essentials');
});
