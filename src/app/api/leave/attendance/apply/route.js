// POST /api/leave/attendance/apply — Employee applies for attendance regularization
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { assertOrigin, ApiError, jsonBody } from '@/lib/server/api';
export const runtime = 'nodejs';

const VALID_ATT_STATUS = ['PRESENT', 'HALF_DAY', 'ABSENT', 'WEEK_OFF'];
const VALID_SHIFTS = ['GENERAL', 'MORNING', 'EVENING', 'NIGHT'];

export const POST = leaveAuthenticated(async (request, _ctx, actor, db) => {
  assertOrigin(request);
  const body = await jsonBody(request);
  const {
    att_date, week_off, shift,
    shift_in, shift_out,
    request_in, request_out,
    att_status, reason,
  } = body;

  if (!att_date) throw new ApiError(400, 'Attendance date is required.');
  const date = new Date(att_date);
  if (isNaN(date.getTime())) throw new ApiError(400, 'Invalid attendance date.');
  if (!reason?.trim()) throw new ApiError(400, 'Reason is required.');
  if (att_status && !VALID_ATT_STATUS.includes(att_status))
    throw new ApiError(400, 'Invalid attendance status.');

  // Upsert by [employee_id, att_date]
  const existing = await db.employee_attendance.findFirst({
    where: { employee_id: actor.id, att_date: date },
  });

  const data = {
    employee_id: actor.id,
    att_date: date,
    week_off: week_off === true || week_off === 'Yes',
    shift: shift || 'GENERAL',
    shift_in: shift_in || null,
    shift_out: shift_out || null,
    request_in: request_in || null,
    request_out: request_out || null,
    att_status: att_status || 'PRESENT',
    reason: reason.trim(),
    status: 'PENDING_TL',
    updated_at: new Date(),
  };

  let record;
  if (existing) {
    record = await db.employee_attendance.update({
      where: { id: existing.id },
      data,
      select: { id: true, status: true, att_date: true },
    });
  } else {
    record = await db.employee_attendance.create({
      data: { ...data, created_at: new Date() },
      select: { id: true, status: true, att_date: true },
    });
  }
  return { success: true, record };
});
