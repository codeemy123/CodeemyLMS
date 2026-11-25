// GET /api/leave/permission/pending/admin — Admin/Manager sees Permission/OD pending final approval
import { leaveAdminAuthenticated } from '@/lib/server/leave-auth';
import { MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

export const GET = leaveAdminAuthenticated(async (_req, _ctx, _actor, db) => {
  const records = await db.permission_od_requests.findMany({
    where: { status: 'PENDING_ADMIN' },
    orderBy: { created_at: 'asc' },
    select: {
      id: true, od_type: true, day_type: true, session_type: true,
      from_date: true, to_date: true,
      from_location: true, to_location: true,
      from_time: true, to_time: true,
      reason: true, status: true, created_at: true,
      tl_action: true, tl_note: true, tl_reviewed_at: true,
      hr_action: true, hr_note: true, hr_reviewed_at: true,
      employee: { select: { id: true, full_name: true, emp_role: true, department: true } },
    },
  });
  return { records };
}, MANAGER_ROLES);
