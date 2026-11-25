// POST /api/leave/apply — Employee submits a new leave application
import { leaveAuthenticated } from '@/lib/server/leave-auth';
import { assertOrigin, ApiError, jsonBody } from '@/lib/server/api';
export const runtime = 'nodejs';

const VALID_TYPES = ['SICK', 'CASUAL', 'EMERGENCY', 'OTHER'];

export const POST = leaveAuthenticated(async (request, _ctx, actor, db) => {
  assertOrigin(request);
  const body = await jsonBody(request);
  const { leaveType, fromDate, toDate, subject, reason, documentUrl } = body;

  if (!VALID_TYPES.includes(leaveType)) throw new ApiError(400, 'Invalid leave type.');
  if (!fromDate || !toDate || !subject?.trim() || !reason?.trim())
    throw new ApiError(400, 'All fields are required.');
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to)
    throw new ApiError(400, 'Invalid date range.');

  const leave = await db.leave_applications.create({
    data: {
      employee_id: actor.id,
      leave_type: leaveType,
      from_date: from,
      to_date: to,
      subject: subject.trim(),
      reason: reason.trim(),
      document_url: documentUrl || null,
      status: 'PENDING_TL',
    },
    select: { id: true, status: true, created_at: true },
  });
  return { success: true, leave };
});
