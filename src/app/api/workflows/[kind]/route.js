import { authenticated } from '@/lib/server/auth';
import { jsonBody } from '@/lib/server/api';
import { workflowRead, workflowWrite } from '@/lib/server/learning-workflows';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, context, actor, db) =>
  workflowRead(db, actor, (await context.params).kind),
);
export const POST = authenticated(async (request, context, actor, db) => {
  const { kind } = await context.params;
  const body = await jsonBody(request);
  return db.$transaction((tx) => workflowWrite(tx, actor, kind, body));
});
