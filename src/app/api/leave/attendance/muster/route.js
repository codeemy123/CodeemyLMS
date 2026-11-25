// GET /api/leave/attendance/muster — Monthly muster for team (TL/HR/Admin) or self
// ?month=YYYY-MM  &employeeId=UUID (optional, for TL/HR/Admin to view specific employee)
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { TL_ROLES, HR_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

export const GET = leaveAuthenticated(async (request, _ctx, actor, db) => {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const empIdParam = url.searchParams.get('employeeId');

  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);

  const isPrivileged = [...TL_ROLES, ...HR_ROLES, ...MANAGER_ROLES].includes(actor.emp_role);

  // Determine which employees to show
  let employeeIds;
  if (isPrivileged && empIdParam) {
    employeeIds = [empIdParam];
  } else if (!isPrivileged) {
    employeeIds = [actor.id];
  } else {
    // TL: their team; HR/Manager: all
    if (TL_ROLES.includes(actor.emp_role) && !MANAGER_ROLES.includes(actor.emp_role)) {
      const teamMembers = await db.employees.findMany({
        where: { team_leader_id: actor.id, status: 'ACTIVE' },
        select: { id: true },
      });
      employeeIds = [actor.id, ...teamMembers.map(e => e.id)];
    } else {
      employeeIds = null; // all employees
    }
  }

  const where = {
    att_date: { gte: start, lte: end },
    ...(employeeIds ? { employee_id: { in: employeeIds } } : {}),
  };

  const records = await db.employee_attendance.findMany({
    where,
    orderBy: [{ employee_id: 'asc' }, { att_date: 'asc' }],
    select: {
      id: true, att_date: true, att_status: true, week_off: true,
      shift: true, shift_in: true, shift_out: true,
      request_in: true, request_out: true,
      status: true, reason: true,
      employee: { select: { id: true, full_name: true, emp_role: true, department: true } },
    },
  });

  // Group by employee
  const byEmployee = {};
  for (const r of records) {
    const eid = r.employee.id;
    if (!byEmployee[eid]) {
      byEmployee[eid] = { employee: r.employee, days: [] };
    }
    byEmployee[eid].days.push({
      att_date: r.att_date,
      att_status: r.att_status,
      week_off: r.week_off,
      shift: r.shift,
      shift_in: r.shift_in,
      shift_out: r.shift_out,
      request_in: r.request_in,
      request_out: r.request_out,
      status: r.status,
    });
  }

  return { month, muster: Object.values(byEmployee) };
});
