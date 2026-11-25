import { leaveAdminAuthenticated } from '@/lib/server/leave-auth';
import { assertOrigin, ApiError, jsonBody } from '@/lib/server/api';
export const runtime = 'nodejs';

const VALID_ROLES = [
  'TRAINING_INTERN',
  'INTERN',
  'FULLTIME',
  'TEAM_LEADER',
  'MANAGER',
  'HR',
  'ADMIN',
  'EMPLOYEE',
];
const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];

export const PATCH = leaveAdminAuthenticated(async (request, { params }, _actor, db) => {
  assertOrigin(request);
  const { id } = await params;
  const body = await jsonBody(request);
  const data = {};

  if (body.empRole !== undefined) {
    if (!VALID_ROLES.includes(body.empRole)) throw new ApiError(400, 'Invalid role.');
    data.emp_role = body.empRole;
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) throw new ApiError(400, 'Invalid status.');
    data.status = body.status;
  }
  if (body.teamLeaderId !== undefined) {
    data.team_leader_id = body.teamLeaderId || null;
  }
  if (body.department !== undefined) {
    data.department = typeof body.department === 'string' ? body.department.trim() || null : null;
  }
  if (body.fullName !== undefined && typeof body.fullName === 'string' && body.fullName.trim()) {
    data.full_name = body.fullName.trim();
  }

  const employee = await db.employees.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      full_name: true,
      emp_role: true,
      status: true,
      department: true,
      team_leader_id: true,
    },
  });
  return { success: true, employee };
}, ['HR', 'MANAGER', 'ADMIN']);
