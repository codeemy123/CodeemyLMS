import { authenticated } from '@/lib/server/auth';
import { roleAllowed } from '@/lib/server/api';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN', 'MENTOR']);
  const users = await db.users.findMany({
    where:
      actor.role === 'ADMIN'
        ? {}
        : { role: 'STUDENT', batch_members: { some: { batches: { mentor_id: actor.id } } } },
    select: { id: true, full_name: true, email: true, phone: true, role: true, status: true },
    orderBy: { full_name: 'asc' },
  });
  return { users };
});
