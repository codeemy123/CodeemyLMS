import { authenticated } from '@/lib/server/auth';
import { ApiError, uuid } from '@/lib/server/api';
import { certificatePdf } from '@/lib/exports';
export const GET = authenticated(async (_request, context, actor, db) => {
  const certificate = await db.certificates.findFirst({
    where: {
      id: uuid((await context.params).id),
      ...(actor.role === 'ADMIN' ? {} : { student_id: actor.id }),
    },
    include: { courses: true, users: true },
  });
  if (!certificate) throw new ApiError(404, 'Certificate not found.');
  const event = await db.audit_logs.findFirst({
    where: { entity_type: 'certificate_history', entity_id: certificate.id },
    orderBy: { created_at: 'desc' },
  });
  if (event?.action === 'CERTIFICATE_REVOKED')
    throw new ApiError(410, 'This certificate was revoked.');
  const pdf = certificatePdf({
    name: certificate.users.full_name,
    course: certificate.courses.title,
    number: certificate.certificate_number,
    date: certificate.issued_at?.toISOString().slice(0, 10) || '',
    status: 'Issued',
    production: true,
  });
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="CodeEmy-certificate.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
});
