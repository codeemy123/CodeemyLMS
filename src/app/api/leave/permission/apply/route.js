// POST /api/leave/permission/apply — Employee submits a Permission/OD request
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { assertOrigin, ApiError, jsonBody } from '@/lib/server/api';
export const runtime = 'nodejs';

const VALID_OD_TYPES = ['PERMISSION', 'ON_DUTY'];
const VALID_DAY_TYPES = ['HOURLY', 'HALF_DAY', 'FULL_DAY'];
const VALID_SESSIONS = ['MORNING', 'AFTERNOON', 'FULL_DAY'];

export const POST = leaveAuthenticated(async (request, _ctx, actor, db) => {
  assertOrigin(request);
  const body = await jsonBody(request);
  const {
    od_type, day_type, session_type,
    from_date, to_date,
    from_location, to_location,
    from_time, to_time,
    reason,
  } = body;

  if (!VALID_OD_TYPES.includes(od_type))
    throw new ApiError(400, 'Invalid OD type. Must be PERMISSION or ON_DUTY.');
  if (!VALID_DAY_TYPES.includes(day_type || 'HOURLY'))
    throw new ApiError(400, 'Invalid day type.');
  if (session_type && !VALID_SESSIONS.includes(session_type))
    throw new ApiError(400, 'Invalid session type.');
  if (!from_date || !to_date)
    throw new ApiError(400, 'From date and To date are required.');
  if (!reason?.trim())
    throw new ApiError(400, 'Reason is required.');

  const from = new Date(from_date);
  const to = new Date(to_date);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to)
    throw new ApiError(400, 'Invalid date range.');

  const record = await db.permission_od_requests.create({
    data: {
      employee_id: actor.id,
      od_type,
      day_type: day_type || 'HOURLY',
      session_type: session_type || null,
      from_date: from,
      to_date: to,
      from_location: from_location?.trim() || null,
      to_location: to_location?.trim() || null,
      from_time: from_time || null,
      to_time: to_time || null,
      reason: reason.trim(),
      status: 'PENDING_TL',
    },
    select: { id: true, status: true, created_at: true },
  });
  return { success: true, record };
});
