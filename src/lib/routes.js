import { roleRoutes } from '../config/routes.js';

// Titles are converted to readable mock IDs. A real backend can supply stable IDs later.
export function toSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function workspaceHref(role, page = 'Dashboard', detail = null) {
  const roleKey = role.toLowerCase();
  const routes = roleRoutes[roleKey];
  if (!routes) throw new Error(`Unknown role: ${role}`);
  const section = Object.keys(routes).find((key) => routes[key] === page);
  if (!section) throw new Error(`Unknown ${role} page: ${page}`);
  return `/${roleKey}/${section}${detail ? '/' + toSlug(detail.title) : ''}`;
}

export function resolveWorkspaceRoute(
  pathname,
  courses,
  rows,
  students,
  mentors = ['Arjun Kumar', 'Priya Sharma', 'Rahul Verma'],
) {
  const [roleKey = 'student', section = 'dashboard', id] = pathname.split('/').filter(Boolean);
  const role = roleKey[0].toUpperCase() + roleKey.slice(1);
  const page = roleRoutes[roleKey]?.[section] || 'Dashboard';
  if (!id) return { role, page, detail: null };

  if (section === 'courses') {
    const course = courses.find((item) => toSlug(item.title) === id);
    return { role, page, detail: course || { title: id, missing: true } };
  }
  const people = page === 'Students' ? students : page === 'Mentors' ? mentors : [];
  const person = people.find((name) => toSlug(name) === id);
  const row = (rows[page] || []).find((item) => toSlug(item[0]) === id);
  return {
    role,
    page,
    detail: person
      ? { title: person }
      : row
        ? { title: row[0], row }
        : { title: id, missing: true },
  };
}
