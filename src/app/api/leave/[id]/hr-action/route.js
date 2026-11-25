// POST /api/leave/[id]/hr-action — HR approve or reject
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { assertOrigin, ApiError, jsonBody } from '@/lib/server/api';
export const runtime = 'nodejs';

export const POST = leaveAuthenticated(async (request, { params }, actor, db) => {
  assertOrigin(request);
  if (!['HR', 'ADMIN'].includes(actor.emp_role))
    throw new ApiError(403, 'Only HR can review at this stage.');
  const { id } = await params;
  const body = await jsonBody(request);
  const { action, note } = body;
  if (!['APPROVE', 'REJECT'].includes(action)) throw new ApiError(400, 'Invalid action.');

  const leave = await db.leave_applications.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!leave) throw new ApiError(404, 'Leave not found.');
  if (leave.status !== 'PENDING_HR') throw new ApiError(409, 'Leave is not pending HR review.');

  const updated = await db.leave_applications.update({
    where: { id },
    data: {
      hr_action: action,
      hr_note: note?.trim() || null,
      hr_reviewed_at: new Date(),
      hr_reviewed_by: actor.id,
      status: action === 'APPROVE' ? 'PENDING_ADMIN' : 'REJECTED',
    },
    select: { id: true, status: true },
  });
  return { success: true, leave: updated };
});
