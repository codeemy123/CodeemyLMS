// GET /api/leave/attendance/pending/hr
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { ApiError } from '@/lib/server/api';
import { HR_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

export const GET = leaveAuthenticated(async (_req, _ctx, actor, db) => {
  const isHR = HR_ROLES.includes(actor.emp_role);
  const isManager = MANAGER_ROLES.includes(actor.emp_role);
  if (!isHR && !isManager) throw new ApiError(403, 'HR access required.');

  const records = await db.employee_attendance.findMany({
    where: { status: 'PENDING_HR' },
    orderBy: { att_date: 'asc' },
    select: {
      id: true, att_date: true, week_off: true, shift: true,
      shift_in: true, shift_out: true, request_in: true, request_out: true,
      att_status: true, reason: true, status: true, created_at: true,
      tl_action: true, tl_note: true, tl_reviewed_at: true,
      employee: { select: { id: true, full_name: true, emp_role: true, department: true } },
    },
  });
  return { records };
});
