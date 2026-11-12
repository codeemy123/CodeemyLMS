import { authenticated } from '@/lib/server/auth';
import { roleAllowed } from '@/lib/server/api';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const [students, mentors, courses, batches, assignments, submissions, assessments, certificates] =
    await Promise.all([
      db.users.count({ where: { role: 'STUDENT' } }),
      db.users.count({ where: { role: 'MENTOR' } }),
      db.courses.count(),
      db.batches.count(),
      db.assignments.count(),
      db.assignment_submissions.count(),
      db.assessments.count(),
      db.certificates.count(),
    ]);
  return {
    counts: {
      students,
      mentors,
      courses,
      batches,
      assignments,
      submissions,
      assessments,
      certificates,
    },
  };
});
