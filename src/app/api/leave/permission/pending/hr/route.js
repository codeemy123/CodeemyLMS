// GET /api/leave/permission/pending/hr — HR sees Permission/OD pending at HR stage
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { ApiError } from '@/lib/server/api';
import { HR_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

export const GET = leaveAuthenticated(async (_req, _ctx, actor, db) => {
  const isHR = HR_ROLES.includes(actor.emp_role);
  const isManager = MANAGER_ROLES.includes(actor.emp_role);
  if (!isHR && !isManager) throw new ApiError(403, 'HR access required.');

  const records = await db.permission_od_requests.findMany({
    where: { status: 'PENDING_HR' },
    orderBy: { created_at: 'asc' },
    select: {
      id: true, od_type: true, day_type: true, session_type: true,
      from_date: true, to_date: true,
      from_location: true, to_location: true,
      from_time: true, to_time: true,
      reason: true, status: true, created_at: true,
      tl_action: true, tl_note: true, tl_reviewed_at: true,
      employee: { select: { id: true, full_name: true, emp_role: true, department: true } },
    },
  });
  return { records };
});
