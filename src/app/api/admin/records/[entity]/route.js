import { authenticated } from '@/lib/server/auth';
import { jsonBody, roleAllowed } from '@/lib/server/api';
import { resourceConfig, saveAdminRecord } from '@/lib/server/admin-records';
import { presentAnnouncement } from '@/lib/announcement-content';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const { entity } = await context.params;
  const config = resourceConfig(entity);
  const records = await db[config.model].findMany({
    where:
      entity === 'careers'
        ? { resource_type: 'CAREER' }
        : entity === 'resources'
          ? { OR: [{ resource_type: null }, { resource_type: { not: 'CAREER' } }] }
          : entity === 'people'
            ? { role: { in: ['STUDENT', 'MENTOR'] } }
            : {},
    orderBy: { id: 'desc' },
  });
  return { records: entity === 'announcements' ? records.map(presentAnnouncement) : records };
});
export const POST = authenticated(async (request, context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  return saveAdminRecord(db, actor, (await context.params).entity, null, await jsonBody(request));
});
