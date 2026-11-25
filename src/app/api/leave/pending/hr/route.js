// GET /api/leave/pending/hr — HR sees TL-approved leaves
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { ApiError } from '@/lib/server/api';
import { HR_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

export const GET = leaveAuthenticated(async (_req, _ctx, actor, db) => {
  if (![...HR_ROLES, ...MANAGER_ROLES].includes(actor.emp_role))
    throw new ApiError(403, 'Only HR can view this.');
  const leaves = await db.leave_applications.findMany({
    where: { status: 'PENDING_HR' },
    orderBy: { tl_reviewed_at: 'asc' },
    select: {
      id: true, leave_type: true, from_date: true, to_date: true,
      subject: true, reason: true, document_url: true, status: true, created_at: true,
      tl_action: true, tl_note: true, tl_reviewed_at: true,
      employee: { select: { id: true, full_name: true, email: true, department: true } },
      tl_reviewer: { select: { full_name: true } },
    },
  });
  return { leaves };
});
