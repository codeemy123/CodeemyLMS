// GET /api/leave/my — Employee sees their own leave applications + annual balance
import { leaveAuthenticated } from '@/lib/server/leave-auth';
export const runtime = 'nodejs';

export const ANNUAL_LEAVE_ALLOWANCE = {
  CASUAL: 12,
  SICK: 12,
  EMERGENCY: 6,
  OTHER: 6,
};

export function computeLeaveBalance(leaves, year = new Date().getUTCFullYear()) {
  const used = { CASUAL: 0, SICK: 0, EMERGENCY: 0, OTHER: 0, total: 0 };
  for (const l of leaves) {
    if (l.status !== 'APPROVED') continue;
    const from = new Date(l.from_date);
    const to = new Date(l.to_date);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) continue;
    if (from.getUTCFullYear() !== year && to.getUTCFullYear() !== year) continue;
    const days = Math.max(1, Math.round((to - from) / 86400000) + 1);
    const key = Object.prototype.hasOwnProperty.call(used, l.leave_type) ? l.leave_type : 'OTHER';
    used[key] += days;
    used.total += days;
  }
  const allowanceTotal = Object.values(ANNUAL_LEAVE_ALLOWANCE).reduce((a, b) => a + b, 0);
  const remaining = {
    CASUAL: Math.max(0, ANNUAL_LEAVE_ALLOWANCE.CASUAL - used.CASUAL),
    SICK: Math.max(0, ANNUAL_LEAVE_ALLOWANCE.SICK - used.SICK),
    EMERGENCY: Math.max(0, ANNUAL_LEAVE_ALLOWANCE.EMERGENCY - used.EMERGENCY),
    OTHER: Math.max(0, ANNUAL_LEAVE_ALLOWANCE.OTHER - used.OTHER),
    total: Math.max(0, allowanceTotal - used.total),
  };
  return { year, allowance: { ...ANNUAL_LEAVE_ALLOWANCE, total: allowanceTotal }, used, remaining };
}

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
  return { leaves, balance: computeLeaveBalance(leaves) };
});
