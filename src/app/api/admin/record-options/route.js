import { authenticated } from '@/lib/server/auth';
import { roleAllowed } from '@/lib/server/api';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const [users, courses, batches, modules, assessments, questions] = await Promise.all([
    db.users.findMany({
      where: { role: { in: ['STUDENT', 'MENTOR'] } },
      select: { id: true, full_name: true, role: true, status: true },
    }),
    db.courses.findMany({ select: { id: true, title: true } }),
    db.batches.findMany({ select: { id: true, name: true, course_id: true } }),
    db.course_modules.findMany({ select: { id: true, title: true, course_id: true } }),
    db.assessments.findMany({ select: { id: true, title: true } }),
    db.questions.findMany({ select: { id: true, question_text: true, assessment_id: true } }),
  ]);
  return {
    mentors: users
      .filter((u) => u.role === 'MENTOR' && u.status === 'ACTIVE')
      .map((u) => ({ id: u.id, title: u.full_name })),
    students: users
      .filter((u) => u.role === 'STUDENT')
      .map((u) => ({ id: u.id, title: u.full_name })),
    courses,
    batches: batches.map((b) => ({ ...b, title: b.name })),
    modules,
    assessments,
    questions: questions.map((q) => ({ ...q, title: q.question_text })),
  };
});
