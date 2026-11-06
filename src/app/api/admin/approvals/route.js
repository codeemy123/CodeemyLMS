import { authenticated } from '@/lib/server/auth';
import { roleAllowed } from '@/lib/server/api';
import { registrationActions } from '@/lib/server/registrations';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const records = await db.audit_logs.findMany({
    where: { action: 'REGISTRATION_REQUESTED', entity_type: 'account_registration' },
    include: {
      users: {
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          created_at: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
  const decisions = await db.audit_logs.findMany({
    where: {
      entity_type: 'account_registration',
      action: { in: registrationActions },
      entity_id: { in: records.map((r) => r.entity_id).filter(Boolean) },
    },
    include: { users: { select: { full_name: true } } },
    orderBy: { created_at: 'desc' },
  });
  const requests = records
    .filter((r) => r.users)
    .map((r) => {
      const decision = decisions.find((d) => d.entity_id === r.entity_id);
      return {
        id: r.id,
        user: r.users,
        details: r.details,
        submittedAt: r.created_at,
        status: decision
          ? decision.action.replace('REGISTRATION_', '')
          : r.users.status === 'ACTIVE'
            ? 'APPROVED'
            : 'PENDING',
        reason: decision?.details?.reason || '',
        reviewedAt: decision?.created_at || null,
        reviewedBy: decision?.users?.full_name || null,
      };
    });
  return { requests, pendingCount: requests.filter((r) => r.status === 'PENDING').length };
});
