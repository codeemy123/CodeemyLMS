import { authenticated } from '@/lib/server/auth';
import { jsonBody, text, ApiError } from '@/lib/server/api';
import { authorizeObject } from '@/lib/server/storage-access';
export const runtime = 'nodejs';
export const GET = authenticated(async (_request, _context, actor, db) => ({
  user: await db.users.findUnique({
    where: { id: actor.id },
    select: {
      id: true,
      full_name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      profile_image: true,
      student_profiles: true,
      mentor_profiles: true,
    },
  }),
}));
export const PATCH = authenticated(async (request, _context, actor, db) => {
  const body = await jsonBody(request);
  const data = { updated_at: new Date() };
  if (body.collegeName !== undefined) {
    if (actor.role !== 'STUDENT') throw new ApiError(403, 'College details are for students.');
    data.student_profiles = {
      upsert: {
        create: { college_name: text(body.collegeName, 255, false) || null },
        update: {
          college_name: text(body.collegeName, 255, false) || null,
          updated_at: new Date(),
        },
      },
    };
  }
  if (body.fullName !== undefined) data.full_name = text(body.fullName, 150);
  if (body.phone !== undefined) data.phone = text(body.phone, 20, false) || null;
  if (body.photo !== undefined) {
    if (body.photo === null) data.profile_image = null;
    else {
      const photo = text(body.photo, 3000);
      const url = new URL(photo, 'http://storage.local');
      if (url.origin !== 'http://storage.local' || url.pathname !== '/api/storage/object')
        throw new ApiError(400, 'Upload a profile image first.');
      await authorizeObject(request, url.searchParams.get('key'));
      const file = await db.audit_logs.findFirst({
        where: {
          action: 'FILE_UPLOADED',
          user_id: actor.id,
          details: { path: ['key'], equals: url.searchParams.get('key') },
        },
      });
      if (!file || !file.details.type?.startsWith('image/') || file.details.size > 5242880)
        throw new ApiError(400, 'Select your own uploaded image, up to 5 MB.');
      data.profile_image = photo;
    }
  }
  const user = await db.users.update({
    where: { id: actor.id },
    data,
    select: {
      id: true,
      full_name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      profile_image: true,
      student_profiles: true,
    },
  });
  return { user };
});
