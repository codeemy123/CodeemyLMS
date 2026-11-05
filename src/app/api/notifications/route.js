import { authenticated } from '@/lib/server/auth';
import { ApiError, jsonBody, uuid } from '@/lib/server/api';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => ({
  notifications: await db.notifications.findMany({
    where: { user_id: actor.id },
    orderBy: { created_at: 'desc' },
    take: 200,
  }),
  unreadCount: await db.notifications.count({ where: { user_id: actor.id, is_read: false } }),
}));
export const PATCH = authenticated(async (request, _context, actor, db) => {
  const body = await jsonBody(request);
  let ids;
  if (body.all !== true) {
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 200)
      throw new ApiError(400, 'Choose notifications to mark as read.');
    ids = [...new Set(body.ids.map(uuid))];
  }
  return db.$transaction(async (tx) => {
    if (
      ids &&
      (await tx.notifications.count({ where: { user_id: actor.id, id: { in: ids } } })) !==
        ids.length
    )
      throw new ApiError(404, 'Notification not found.');
    const result = await tx.notifications.updateMany({
      where: { user_id: actor.id, ...(ids ? { id: { in: ids } } : {}) },
      data: { is_read: true },
    });
    return { updated: result.count };
  });
});
