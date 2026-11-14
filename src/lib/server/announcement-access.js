import { courseScope } from './data-access.js';
export async function announcementScope(db, actor) {
  if (actor.role === 'ADMIN') return {};
  const [courses, batches] = await Promise.all([
    db.courses.findMany({ where: courseScope(actor), select: { id: true } }),
    db.batches.findMany({
      where:
        actor.role === 'MENTOR'
          ? { mentor_id: actor.id }
          : { batch_members: { some: { student_id: actor.id } } },
      select: { id: true },
    }),
  ]);
  return {
    published_at: { lte: new Date() },
    AND: [
      { OR: [{ course_id: null }, { course_id: { in: courses.map((c) => c.id) } }] },
      { OR: [{ batch_id: null }, { batch_id: { in: batches.map((b) => b.id) } }] },
    ],
  };
}
