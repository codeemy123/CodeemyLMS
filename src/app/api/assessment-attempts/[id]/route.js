import { authenticated } from '@/lib/server/auth';
import { jsonBody, uuid } from '@/lib/server/api';
import { finishAttempt } from '@/lib/server/assessment-workflows';
export const PATCH = authenticated(async (request, context, actor, db) => {
  const id = uuid((await context.params).id),
    body = await jsonBody(request);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM assessment_attempts WHERE id = ${id}::uuid FOR UPDATE`;
    return finishAttempt(tx, actor, id, body);
  });
});
