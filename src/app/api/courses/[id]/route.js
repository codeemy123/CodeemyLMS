import { authenticated } from '@/lib/server/auth';
import { requireCourse } from '@/lib/server/data-access';
import { jsonBody, roleAllowed, text, choice, uuid } from '@/lib/server/api';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, context, actor, db) => ({
  course: await requireCourse(db, actor, uuid((await context.params).id)),
}));
export const PATCH = authenticated(async (request, context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const id = uuid((await context.params).id);
  await requireCourse(db, actor, id);
  const body = await jsonBody(request),
    data = { updated_at: new Date() };
  if ('title' in body) data.title = text(body.title);
  if ('description' in body) data.description = text(body.description, 20000, false);
  if ('category' in body) data.category = text(body.category, 150, false);
  if ('status' in body) data.status = choice(body.status, ['DRAFT', 'PUBLISHED', 'ARCHIVED']);
  return { course: await db.courses.update({ where: { id }, data }) };
});
