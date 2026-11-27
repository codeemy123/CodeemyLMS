// POST /api/leave/permission/[id]/action — TL/HR/Admin approves or rejects a Permission/OD
import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { requireLeaveOrLmsAdmin } from '@/lib/server/leave-auth';
import { assertOrigin, ApiError, jsonBody } from '@/lib/server/api';
import { ALL_VALID_LEAVE_ROLES, TL_ROLES, HR_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
export const runtime = 'nodejs';

export async function POST(request, context) {
  try {
    assertOrigin(request);
    const actor = await requireLeaveOrLmsAdmin(request, ALL_VALID_LEAVE_ROLES);
    const { id } = await context.params;
    if (!id) throw new ApiError(400, 'Missing ID.');

    const body = await jsonBody(request);
    const { action, note } = body;
    if (!['APPROVE', 'REJECT'].includes(action)) throw new ApiError(400, 'Action must be APPROVE or REJECT.');

    const db = getPrisma();
    const record = await db.permission_od_requests.findUnique({
      where: { id },
      include: { employee: { select: { team_leader_id: true } } },
    });
    if (!record) throw new ApiError(404, 'Permission/OD request not found.');

    const isTL = TL_ROLES.includes(actor.emp_role);
    const isHR = HR_ROLES.includes(actor.emp_role);
    const isManager = MANAGER_ROLES.includes(actor.emp_role);

    let updateData;
    if (record.status === 'PENDING_TL' && (isTL || isManager)) {
      if (isTL && !isManager && record.employee?.team_leader_id !== actor.id) {
        throw new ApiError(403, 'This employee is not in your team.');
      }
      updateData = {
        tl_action: action,
        tl_note: note?.trim() || null,
        tl_reviewed_at: new Date(),
        tl_reviewed_by: actor.id,
        status: action === 'APPROVE' ? 'PENDING_HR' : 'REJECTED',
        updated_at: new Date(),
      };
    } else if (record.status === 'PENDING_HR' && (isHR || isManager)) {
      updateData = {
        hr_action: action,
        hr_note: note?.trim() || null,
        hr_reviewed_at: new Date(),
        hr_reviewed_by: actor.id,
        status: action === 'APPROVE' ? 'PENDING_ADMIN' : 'REJECTED',
        updated_at: new Date(),
      };
    } else if (record.status === 'PENDING_ADMIN' && isManager) {
      updateData = {
        admin_action: action,
        admin_note: note?.trim() || null,
        admin_reviewed_at: new Date(),
        admin_reviewed_by: actor.id,
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        updated_at: new Date(),
      };
    } else {
      throw new ApiError(403, 'You cannot act on this request at this stage.');
    }

    const updated = await db.permission_od_requests.update({
      where: { id },
      data: updateData,
      select: { id: true, status: true, updated_at: true },
    });
    return NextResponse.json({ success: true, record: updated }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error.status || 500;
    const message = error.status ? error.message : 'Request failed.';
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
