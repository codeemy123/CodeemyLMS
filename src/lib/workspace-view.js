// Preview identities; replace with the authenticated account at backend integration.
export function workspaceView(role, courses, students, rows, workflows) {
  const batches = Object.entries(workflows.batches).filter(
    ([, b]) =>
      role === 'Admin' ||
      (role === 'Student' ? b.students.includes('Kavin Raj') : b.mentor === 'Arjun Kumar'),
  );
  const assigned = new Set(batches.map(([, b]) => b.course));
  const visibleCourses = courses.filter(
    (c) =>
      role === 'Admin' ||
      assigned.has(c.title) ||
      (role === 'Mentor' &&
        c.mentor === 'Arjun Kumar' &&
        !Object.values(workflows.batches).some((b) => b.course === c.title)) ||
      (role === 'Student' && workflows.certificates[c.title]?.name === 'Kavin Raj'),
  );
  const visibleStudents =
    role === 'Admin'
      ? students
      : role === 'Student'
        ? students.filter((n) => n === 'Kavin Raj')
        : students.filter((n) => batches.some(([, b]) => b.students.includes(n)));
  const titles = new Set(visibleCourses.map((c) => c.title));
  const visibleRows = Object.fromEntries(
    Object.entries(rows).map(([page, list]) => [
      page,
      role === 'Admin'
        ? list
        : ['Assignments', 'Projects', 'Assessments', 'Classes'].includes(page)
          ? list.filter((row) => titles.has(row[1]))
          : page === 'Certificates' && role === 'Student'
            ? list.filter((row) => workflows.certificates[row[0]]?.name === 'Kavin Raj')
            : list,
    ]),
  );
  return {
    courses: visibleCourses.map((c) => {
      const batch = batches.find(([, b]) => b.course === c.title);
      return batch ? { ...c, mentor: batch[1].mentor, batch: batch[0] } : c;
    }),
    students: visibleStudents,
    baseRows: visibleRows,
    batches,
  };
}
