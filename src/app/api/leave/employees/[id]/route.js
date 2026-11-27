import { leaveAdminAuthenticated } from '@/lib/server/leave-auth';
import { assertOrigin, ApiError, jsonBody } from '@/lib/server/api';
import { ALL_VALID_LEAVE_ROLES, ADMIN_ONLY_ROLES, HR_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

const VALID_ROLES = ALL_VALID_LEAVE_ROLES;
const VALID_STATUSES = ['ACTIVE', 'INACTIVE'];
const ALLOWED_ADMIN_ROLES = [...HR_ROLES, ...MANAGER_ROLES];

export const PATCH = leaveAdminAuthenticated(async (request, { params }, actor, db) => {
  assertOrigin(request);
  const { id } = await params;
  const target = await db.employees.findUnique({ where: { id }, select: { id: true, emp_role: true } });
  if (!target) throw new ApiError(404, 'Employee not found.');
  if (ADMIN_ONLY_ROLES.includes(target.emp_role) && !ADMIN_ONLY_ROLES.includes(actor.emp_role))
    throw new ApiError(403, 'Only Admin can modify Admin accounts.');
  if (MANAGER_ROLES.includes(target.emp_role) && !MANAGER_ROLES.includes(actor.emp_role))
    throw new ApiError(403, 'Only Management or Admin can modify Manager accounts.');

  const body = await jsonBody(request);
  const data = {};

  if (body.empRole !== undefined) {
    if (!VALID_ROLES.includes(body.empRole)) throw new ApiError(400, 'Invalid role.');
    if (ADMIN_ONLY_ROLES.includes(body.empRole) && !ADMIN_ONLY_ROLES.includes(actor.emp_role))
      throw new ApiError(403, 'Only Admin can assign the Admin role.');
    if (MANAGER_ROLES.includes(body.empRole) && !MANAGER_ROLES.includes(actor.emp_role))
      throw new ApiError(403, 'Only Management or Admin can assign Manager roles.');
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
}, ALLOWED_ADMIN_ROLES);
