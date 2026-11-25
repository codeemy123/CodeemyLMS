// GET /api/leave/all — HR & Admin see all leave applications for full tracking
import { leaveAdminAuthenticated } from '@/lib/server/leave-auth';
export const runtime = 'nodejs';

export const GET = leaveAdminAuthenticated(async (_req, _ctx, _actor, db) => {
  const leaves = await db.leave_applications.findMany({
    orderBy: { created_at: 'desc' },
    take: 200,
    select: {
      id: true,
      leave_type: true,
      from_date: true,
      to_date: true,
      subject: true,
      reason: true,
      document_url: true,
      status: true,
      created_at: true,
      tl_action: true,
      tl_note: true,
      tl_reviewed_at: true,
      hr_action: true,
      hr_note: true,
      hr_reviewed_at: true,
      admin_action: true,
      admin_note: true,
      admin_reviewed_at: true,
      employee: { select: { id: true, full_name: true, email: true, department: true } },
      tl_reviewer: { select: { full_name: true } },
      hr_reviewer: { select: { full_name: true } },
      admin_reviewer: { select: { full_name: true } },
    },
  });
  return { leaves };
}, ['HR', 'MANAGER', 'ADMIN']);
