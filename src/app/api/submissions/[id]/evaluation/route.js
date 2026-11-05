import { authenticated } from '@/lib/server/auth';
import { evaluateSubmission } from '@/lib/server/data-access';
import { jsonBody, uuid, text, numeric, roleAllowed } from '@/lib/server/api';
export const runtime = 'nodejs';
export const POST = authenticated(async (request, context, actor, db) => {
  roleAllowed(actor, ['ADMIN', 'MENTOR']);
  const body = await jsonBody(request),
    id = uuid((await context.params).id);
  return {
    submission: await db.$transaction((tx) =>
      evaluateSubmission(
        tx,
        actor,
        body.kind || 'assignment',
        id,
        numeric(body.marks, 0, 100000),
        text(body.feedback || '', 10000, false),
      ),
    ),
  };
});
