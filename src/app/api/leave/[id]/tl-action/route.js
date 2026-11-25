// POST /api/leave/[id]/tl-action — TL approve or reject
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { assertOrigin, ApiError, jsonBody } from '@/lib/server/api';
export const runtime = 'nodejs';

export const POST = leaveAuthenticated(async (request, { params }, actor, db) => {
  assertOrigin(request);
  if (!['TEAM_LEADER', 'MANAGER', 'ADMIN'].includes(actor.emp_role))
    throw new ApiError(403, 'Only Team Leaders can review at this stage.');
  const { id } = await params;
  const body = await jsonBody(request);
  const { action, note } = body;
  if (!['APPROVE', 'REJECT'].includes(action)) throw new ApiError(400, 'Invalid action.');

  const leave = await db.leave_applications.findUnique({ where: { id }, select: { id: true, status: true, employee: { select: { team_leader_id: true } } } });
  if (!leave) throw new ApiError(404, 'Leave not found.');
  if (leave.status !== 'PENDING_TL') throw new ApiError(409, 'Leave is not pending TL review.');
  // TLs can only review their own team members (admins can review any)
  if (actor.emp_role === 'TEAM_LEADER' && leave.employee?.team_leader_id !== actor.id)
    throw new ApiError(403, 'This employee is not in your team.');

  const updated = await db.leave_applications.update({
    where: { id },
    data: {
      tl_action: action,
      tl_note: note?.trim() || null,
      tl_reviewed_at: new Date(),
      tl_reviewed_by: actor.id,
      status: action === 'APPROVE' ? 'PENDING_HR' : 'REJECTED',
    },
    select: { id: true, status: true },
  });
  return { success: true, leave: updated };
});
