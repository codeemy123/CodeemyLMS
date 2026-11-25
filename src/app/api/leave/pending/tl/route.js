// GET /api/leave/pending/tl — TL sees team's pending leaves
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { ApiError } from '@/lib/server/api';
import { TL_ROLES, HR_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

export const GET = leaveAuthenticated(async (_req, _ctx, actor, db) => {
  if (![...TL_ROLES, ...HR_ROLES, ...MANAGER_ROLES].includes(actor.emp_role))
    throw new ApiError(403, 'Only Team Leaders can view this.');

  // TL sees their team members' leaves. HR/Manager/Admin see all PENDING_TL leaves.
  const where = TL_ROLES.includes(actor.emp_role)
    ? { status: 'PENDING_TL', employee: { team_leader_id: actor.id } }
    : { status: 'PENDING_TL' };

  const leaves = await db.leave_applications.findMany({
    where,
    orderBy: { created_at: 'asc' },
    select: {
      id: true, leave_type: true, from_date: true, to_date: true,
      subject: true, reason: true, document_url: true, status: true, created_at: true,
      employee: { select: { id: true, full_name: true, email: true, department: true } },
    },
  });
  return { leaves };
});
