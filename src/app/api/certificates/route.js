import { authenticated } from '@/lib/server/auth';
import { ApiError, jsonBody, roleAllowed, uuid, text, choice } from '@/lib/server/api';
export const GET = authenticated(async (_request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN', 'STUDENT']);
  const certificates = await db.certificates.findMany({
    where: actor.role === 'STUDENT' ? { student_id: actor.id } : {},
    include: { courses: { select: { title: true } }, users: { select: { full_name: true } } },
  });
  const events = await db.audit_logs.findMany({
    where: { entity_type: 'certificate_history', entity_id: { in: certificates.map((c) => c.id) } },
    orderBy: { created_at: 'desc' },
  });
  return {
    certificates: certificates.map((c) => {
      const history = events.filter((e) => e.entity_id === c.id);
      return {
        ...c,
        revoked: history[0]?.action === 'CERTIFICATE_REVOKED',
        history: history.map((e) => ({
          action: e.action,
          created_at: e.created_at,
          reason: e.details?.reason,
        })),
      };
    }),
  };
});
export const POST = authenticated(async (request, _context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  const body = await jsonBody(request),
    action = choice(body.action, ['revoke', 'reissue']);
  return db.$transaction(async (tx) => {
    const id = uuid(body.id);
    await tx.$queryRaw`SELECT id FROM certificates WHERE id = ${id}::uuid FOR UPDATE`;
    const certificate = await tx.certificates.findUnique({ where: { id: uuid(body.id) } });
    if (!certificate) throw new ApiError(404, 'Certificate not found.');
    const reason = text(body.reason, 2000);
    await tx.audit_logs.create({
      data: {
        user_id: actor.id,
        action: action === 'revoke' ? 'CERTIFICATE_REVOKED' : 'CERTIFICATE_REISSUED',
        entity_type: 'certificate_history',
        entity_id: certificate.id,
        details: { reason, previousNumber: certificate.certificate_number },
      },
    });
    if (action === 'reissue')
      await tx.certificates.update({
        where: { id: certificate.id },
        data: {
          certificate_number: 'CE-' + crypto.randomUUID(),
          issued_at: new Date(),
          certificate_url: null,
        },
      });
    await tx.notifications.create({
      data: {
        user_id: certificate.student_id,
        title: 'Certificate ' + (action === 'revoke' ? 'revoked' : 'reissued'),
        message: reason,
        type: 'CERTIFICATE',
        reference_id: certificate.id,
      },
    });
    return { saved: true };
  });
});
