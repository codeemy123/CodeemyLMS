// GET /api/leave/permission/my — Employee views own Permission/OD requests
import { leaveAuthenticated } from '@/lib/server/leave-auth';
export const runtime = 'nodejs';

export const GET = leaveAuthenticated(async (_req, _ctx, actor, db) => {
  const records = await db.permission_od_requests.findMany({
    where: { employee_id: actor.id },
    orderBy: { created_at: 'desc' },
    select: {
      id: true, od_type: true, day_type: true, session_type: true,
      from_date: true, to_date: true,
      from_location: true, to_location: true,
      from_time: true, to_time: true,
      reason: true, status: true,
      tl_action: true, tl_note: true, tl_reviewed_at: true,
      hr_action: true, hr_note: true, hr_reviewed_at: true,
      admin_action: true, admin_note: true, admin_reviewed_at: true,
      created_at: true,
    },
  });
  return { records };
});
