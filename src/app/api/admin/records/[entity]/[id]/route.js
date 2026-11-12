import { authenticated } from '@/lib/server/auth';
import { jsonBody, roleAllowed } from '@/lib/server/api';
import { saveAdminRecord, removeAdminRecord } from '@/lib/server/admin-records';
export const runtime = 'nodejs';
export const PATCH = authenticated(async (request, context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const { entity, id } = await context.params;
  return saveAdminRecord(db, actor, entity, id, await jsonBody(request));
});
export const DELETE = authenticated(async (_request, context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const { entity, id } = await context.params;
  return removeAdminRecord(db, actor, entity, id);
});
