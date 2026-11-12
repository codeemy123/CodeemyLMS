import { authenticated } from '@/lib/server/auth';
import { courseScope, requireCourse } from '@/lib/server/data-access';
import { ApiError, jsonBody, uuid, text, choice, roleAllowed } from '@/lib/server/api';
export const GET = authenticated(async (_request, _context, actor, db) => {
  const courses = await db.courses.findMany({ where: courseScope(actor), select: { id: true } });
  return {
    opportunities: await db.resources.findMany({
      where: {
        resource_type: 'CAREER',
        ...(actor.role === 'ADMIN'
          ? {}
          : { OR: [{ course_id: null }, { course_id: { in: courses.map((c) => c.id) } }] }),
      },
      include: {
        career_applications: {
          where: actor.role === 'ADMIN' ? {} : { student_id: actor.id },
          include: { users: { select: { full_name: true } } },
        },
      },
    }),
  };
});
export const POST = authenticated(async (request, _context, actor, db) => {
  const body = await jsonBody(request);
  return db.$transaction(async (tx) => {
    if (actor.role === 'ADMIN') {
      const application = await tx.career_applications.update({
        where: { id: uuid(body.id) },
        data: {
          status: choice(body.status, ['REVIEWING', 'ACCEPTED', 'REJECTED']),
          feedback: text(body.feedback || '', 10000, false),
          updated_at: new Date(),
        },
      });
      await tx.notifications.create({
        data: {
          user_id: application.student_id,
          title: 'Career application updated',
          message: application.status,
          type: 'CAREER',
          reference_id: application.resource_id,
        },
      });
      return { application };
    }
    roleAllowed(actor, ['STUDENT']);
    if (body.action === 'withdraw') {
      const existing = await tx.career_applications.findFirst({
        where: {
          id: uuid(body.id),
          student_id: actor.id,
          status: { in: ['APPLIED', 'REVIEWING'] },
        },
      });
      if (!existing) throw new ApiError(409, 'Application cannot be withdrawn.');
      return {
        application: await tx.career_applications.update({
          where: { id: existing.id },
          data: { status: 'WITHDRAWN', updated_at: new Date() },
        }),
      };
    }
    const opportunity = await tx.resources.findFirst({
      where: { id: uuid(body.id), resource_type: 'CAREER' },
    });
    if (!opportunity) throw new ApiError(404, 'Opportunity not found.');
    if (opportunity.course_id) await requireCourse(tx, actor, opportunity.course_id);
    const application = await tx.career_applications.create({
      data: {
        resource_id: opportunity.id,
        student_id: actor.id,
        cover_note: text(body.note || '', 10000, false),
      },
    });
    const admins = await tx.users.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    await tx.notifications.createMany({
      data: admins.map((a) => ({
        user_id: a.id,
        title: 'New career application',
        message: opportunity.title,
        type: 'CAREER',
        reference_id: opportunity.id,
      })),
    });
    return { application };
  });
});
