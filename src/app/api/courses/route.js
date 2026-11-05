import { authenticated } from '@/lib/server/auth';
import { courseScope } from '@/lib/server/data-access';
import { jsonBody, roleAllowed, text, choice, uuid, ApiError } from '@/lib/server/api';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => ({
  courses: await db.courses.findMany({
    where: courseScope(actor),
    orderBy: { created_at: 'desc' },
    include: {
      users: { select: { id: true, full_name: true } },
      batches: {
        where:
          actor.role === 'ADMIN'
            ? {}
            : actor.role === 'MENTOR'
              ? { mentor_id: actor.id }
              : { batch_members: { some: { student_id: actor.id } } },
        select: { id: true, name: true },
      },
      course_modules: {
        include: {
          lessons: {
            where: actor.role === 'STUDENT' ? { is_published: true } : {},
            select: { id: true, title: true, is_published: true, sort_order: true },
          },
        },
        orderBy: { sort_order: 'asc' },
      },
    },
  }),
}));
export const POST = authenticated(async (request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const body = await jsonBody(request);
  const title = text(body.title),
    slug = text(
      body.slug ||
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
    );
  const mentorId = body.mentorId ? uuid(body.mentorId) : null;
  if (
    mentorId &&
    !(await db.users.findFirst({ where: { id: mentorId, role: 'MENTOR', status: 'ACTIVE' } }))
  )
    throw new ApiError(400, 'Select an active mentor.');
  return {
    course: await db.courses.create({
      data: {
        title,
        slug,
        description: body.description === undefined ? null : text(body.description, 20000, false),
        category: body.category === undefined ? null : text(body.category, 150, false),
        status: choice(body.status || 'DRAFT', ['DRAFT', 'PUBLISHED', 'ARCHIVED']),
        mentor_id: mentorId,
      },
    }),
  };
});
