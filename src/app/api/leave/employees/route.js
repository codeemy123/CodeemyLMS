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

export const GET = leaveAdminAuthenticated(async (_req, _ctx, _actor, db) => {
  const employees = await db.employees.findMany({
    orderBy: [{ emp_role: 'asc' }, { full_name: 'asc' }],
    select: {
      id: true,
      email: true,
      full_name: true,
      phone: true,
      emp_role: true,
      status: true,
      department: true,
      team_leader_id: true,
      created_at: true,
      team_leader: { select: { id: true, full_name: true } },
    },
  });
  return { employees };
}, ['HR', 'MANAGER', 'ADMIN']);

export const POST = leaveAdminAuthenticated(async (request, _ctx, _actor, db) => {
  assertOrigin(request);
  const body = await jsonBody(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const empRole = body.empRole || 'EMPLOYEE';
  const department = typeof body.department === 'string' ? body.department.trim() : null;
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
  const teamLeaderId = body.teamLeaderId || null;

  if (!email || !email.includes('@')) throw new ApiError(400, 'Valid email is required.');
  if (!fullName) throw new ApiError(400, 'Full name is required.');
  if (!VALID_ROLES.includes(empRole)) throw new ApiError(400, 'Invalid employee role.');

  const existing = await db.employees.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) throw new ApiError(409, 'An employee with this email already exists.');

  const employee = await db.employees.create({
    data: {
      firebase_uid: 'pending:' + email,
      email,
      full_name: fullName,
      emp_role: empRole,
      department: department || null,
      phone: phone || null,
      team_leader_id: teamLeaderId || null,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      emp_role: true,
      department: true,
      team_leader_id: true,
      status: true,
    },
  });
  return { success: true, employee };
}, ['HR', 'MANAGER', 'ADMIN']);
