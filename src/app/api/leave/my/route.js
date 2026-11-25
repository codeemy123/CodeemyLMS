// GET /api/leave/my — Employee sees their own leave applications
import { leaveAuthenticated } from '@/lib/server/leave-auth';
export const runtime = 'nodejs';

export const GET = leaveAuthenticated(async (_req, _ctx, actor, db) => {
  const leaves = await db.leave_applications.findMany({
    where: { employee_id: actor.id },
    orderBy: { created_at: 'desc' },
    select: {
      id: true, leave_type: true, from_date: true, to_date: true,
      subject: true, reason: true, document_url: true, status: true, created_at: true,
      tl_action: true, tl_note: true, tl_reviewed_at: true,
      hr_action: true, hr_note: true, hr_reviewed_at: true,
      admin_action: true, admin_note: true, admin_reviewed_at: true,
    },
  });
  return { leaves };
});
