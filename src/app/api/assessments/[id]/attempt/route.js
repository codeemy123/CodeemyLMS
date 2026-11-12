import { authenticated } from '@/lib/server/auth';
import { startAttempt } from '@/lib/server/assessment-workflows';
import { jsonBody } from '@/lib/server/api';
export const POST = authenticated(async (request, context, actor, db) => {
  const { id } = await context.params;
  const options = request.headers.get('content-type')?.includes('application/json')
    ? await jsonBody(request)
    : {};
  return db.$transaction((tx) => startAttempt(tx, actor, id, options), { timeout: 30000 });
});
