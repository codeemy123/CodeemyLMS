// POST /api/leave/permission/[id]/action — TL/HR/Admin approves or rejects a Permission/OD
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { assertOrigin, ApiError, jsonBody } from '@/lib/server/api';
import { TL_ROLES, HR_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

export const POST = leaveAuthenticated(async (request, ctx, actor, db) => {
  assertOrigin(request);
  const id = ctx.params?.id;
  if (!id) throw new ApiError(400, 'Missing ID.');

  const body = await jsonBody(request);
  const { action, note } = body;
  if (!['APPROVE', 'REJECT'].includes(action)) throw new ApiError(400, 'Action must be APPROVE or REJECT.');

  const record = await db.permission_od_requests.findUnique({ where: { id } });
  if (!record) throw new ApiError(404, 'Permission/OD request not found.');

  const isTL = TL_ROLES.includes(actor.emp_role);
  const isHR = HR_ROLES.includes(actor.emp_role);
  const isManager = MANAGER_ROLES.includes(actor.emp_role);

  let updateData;
  if (record.status === 'PENDING_TL' && (isTL || isManager)) {
    updateData = {
      tl_action: action,
      tl_note: note?.trim() || null,
      tl_reviewed_at: new Date(),
      tl_reviewed_by: actor.id,
      status: action === 'APPROVE' ? 'PENDING_HR' : 'REJECTED',
      updated_at: new Date(),
    };
  } else if (record.status === 'PENDING_HR' && (isHR || isManager)) {
    updateData = {
      hr_action: action,
      hr_note: note?.trim() || null,
      hr_reviewed_at: new Date(),
      hr_reviewed_by: actor.id,
      status: action === 'APPROVE' ? 'PENDING_ADMIN' : 'REJECTED',
      updated_at: new Date(),
    };
  } else if (record.status === 'PENDING_ADMIN' && isManager) {
    updateData = {
      admin_action: action,
      admin_note: note?.trim() || null,
      admin_reviewed_at: new Date(),
      admin_reviewed_by: actor.id,
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      updated_at: new Date(),
    };
  } else {
    throw new ApiError(403, 'You cannot act on this request at this stage.');
  }

  const updated = await db.permission_od_requests.update({
    where: { id },
    data: updateData,
    select: { id: true, status: true, updated_at: true },
  });
  return { success: true, record: updated };
});
