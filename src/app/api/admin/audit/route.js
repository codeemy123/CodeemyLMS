import { authenticated } from '@/lib/server/auth';
import { roleAllowed } from '@/lib/server/api';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  return {
    events: await db.audit_logs.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
      select: {
        id: true,
        action: true,
        entity_type: true,
        created_at: true,
        details: true,
        users: { select: { full_name: true } },
      },
    }),
  };
});
