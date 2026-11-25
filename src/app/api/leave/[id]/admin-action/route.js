// POST /api/leave/[id]/admin-action — Admin final approve or reject
import { leaveAdminAuthenticated } from '@/lib/server/leave-auth';
import { assertOrigin, ApiError, jsonBody } from '@/lib/server/api';
export const runtime = 'nodejs';

export const POST = leaveAdminAuthenticated(async (request, { params }, actor, db) => {
  assertOrigin(request);
  const { id } = await params;
  const body = await jsonBody(request);
  const { action, note } = body;
  if (!['APPROVE', 'REJECT'].includes(action)) throw new ApiError(400, 'Invalid action.');

  const leave = await db.leave_applications.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!leave) throw new ApiError(404, 'Leave not found.');
  if (leave.status !== 'PENDING_ADMIN') throw new ApiError(409, 'Leave is not pending Admin review.');

  const updated = await db.leave_applications.update({
    where: { id },
    data: {
      admin_action: action,
      admin_note: note?.trim() || null,
      admin_reviewed_at: new Date(),
      admin_reviewed_by: actor.id,
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    },
    select: { id: true, status: true },
  });
  return { success: true, leave: updated };
}, ['ADMIN']);
