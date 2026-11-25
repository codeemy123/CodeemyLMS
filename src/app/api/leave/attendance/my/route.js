// GET /api/leave/attendance/my — Employee views own attendance records
// ?month=YYYY-MM optional filter
import { leaveAuthenticated } from '@/lib/server/leave-auth';
export const runtime = 'nodejs';

export const GET = leaveAuthenticated(async (request, _ctx, actor, db) => {
  const url = new URL(request.url);
  const month = url.searchParams.get('month'); // e.g. "2026-11"

  let where = { employee_id: actor.id };
  if (month) {
    const [y, m] = month.split('-').map(Number);
    if (y && m) {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      where.att_date = { gte: start, lte: end };
    }
  }

  const records = await db.employee_attendance.findMany({
    where,
    orderBy: { att_date: 'desc' },
    select: {
      id: true, att_date: true, week_off: true, shift: true,
      shift_in: true, shift_out: true,
      request_in: true, request_out: true,
      att_status: true, reason: true, status: true,
      tl_action: true, tl_note: true, tl_reviewed_at: true,
      hr_action: true, hr_note: true, hr_reviewed_at: true,
      admin_action: true, admin_note: true, admin_reviewed_at: true,
      created_at: true,
    },
  });

  // Summary stats
  const approved = records.filter(r => r.status === 'APPROVED');
  const summary = {
    present: approved.filter(r => r.att_status === 'PRESENT').length,
    half_day: approved.filter(r => r.att_status === 'HALF_DAY').length,
    absent: approved.filter(r => r.att_status === 'ABSENT').length,
    week_off: approved.filter(r => r.att_status === 'WEEK_OFF' || r.week_off).length,
    total: records.length,
  };

  return { records, summary };
});
