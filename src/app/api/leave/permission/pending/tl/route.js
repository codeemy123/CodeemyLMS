// GET /api/leave/permission/pending/tl — TL sees Permission/OD pending at TL stage
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { ApiError } from '@/lib/server/api';
import { TL_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

export const GET = leaveAuthenticated(async (_req, _ctx, actor, db) => {
  const isTL = TL_ROLES.includes(actor.emp_role);
  const isManager = MANAGER_ROLES.includes(actor.emp_role);
  if (!isTL && !isManager) throw new ApiError(403, 'TL access required.');

  const where = { status: 'PENDING_TL' };
  if (isTL && !isManager) {
    // TL only sees their direct reports
    where.employee = { team_leader_id: actor.id };
  }

  const records = await db.permission_od_requests.findMany({
    where,
    orderBy: { created_at: 'asc' },
    select: {
      id: true, od_type: true, day_type: true, session_type: true,
      from_date: true, to_date: true,
      from_location: true, to_location: true,
      from_time: true, to_time: true,
      reason: true, status: true, created_at: true,
      employee: { select: { id: true, full_name: true, emp_role: true, department: true } },
    },
  });
  return { records };
});
