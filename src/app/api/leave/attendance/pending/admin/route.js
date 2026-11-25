// GET /api/leave/attendance/pending/admin
import { leaveAdminAuthenticated } from '@/lib/server/leave-auth';
import { MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

export const GET = leaveAdminAuthenticated(async (_req, _ctx, _actor, db) => {
  const records = await db.employee_attendance.findMany({
    where: { status: 'PENDING_ADMIN' },
    orderBy: { att_date: 'asc' },
    select: {
      id: true, att_date: true, week_off: true, shift: true,
      shift_in: true, shift_out: true, request_in: true, request_out: true,
      att_status: true, reason: true, status: true, created_at: true,
      tl_action: true, tl_note: true, tl_reviewed_at: true,
      hr_action: true, hr_note: true, hr_reviewed_at: true,
      employee: { select: { id: true, full_name: true, emp_role: true, department: true } },
    },
  });
  return { records };
}, MANAGER_ROLES);
