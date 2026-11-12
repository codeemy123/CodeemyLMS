import { authenticated } from '@/lib/server/auth';
import { startAttempt } from '@/lib/server/assessment-workflows';
export const POST = authenticated(async (_request, context, actor, db) => {
  const { id } = await context.params;
  return db.$transaction((tx) => startAttempt(tx, actor, id));
});
