export function studentRegistrationNumber(value) {
  return 'Codeemy' + BigInt(value).toString().padStart(2, '0');
}

// Call inside a transaction. The shared lock serializes number allocation across instances.
export async function ensureAcademicIdentity(tx, actor, details = {}) {
  if (!['STUDENT', 'MENTOR'].includes(actor.role)) return;
  const account = await tx.users.findUnique({
    where: { id: actor.id },
    select: { created_at: true },
  });
  const createdAt = details.createdAt || account.created_at || new Date();
  if (actor.role === 'MENTOR') {
    await tx.mentor_profiles.upsert({
      where: { user_id: actor.id },
      create: {
        user_id: actor.id,
        created_at: createdAt,
        qualification: details.qualification || null,
      },
      update: {},
    });
    return;
  }
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(73018321)');
  const existing = await tx.student_profiles.findUnique({
    where: { user_id: actor.id },
    select: {
      registration_number: true,
      admission_date: true,
    },
  });
  let number = existing?.registration_number;
  if (!number) {
    const [row] = await tx.$queryRawUnsafe(
      "SELECT COALESCE(MAX(substring(number FROM '^Codeemy([0-9]+)$')::numeric),0)::text AS last_number FROM (SELECT registration_number AS number FROM public.student_profiles UNION ALL SELECT details->>'registrationNumber' AS number FROM public.audit_logs WHERE action='STUDENT_NUMBER_ALLOCATED') AS allocated",
    );
    number = studentRegistrationNumber(BigInt(row.last_number) + 1n);
  }
  await tx.student_profiles.upsert({
    where: { user_id: actor.id },
    create: {
      user_id: actor.id,
      registration_number: number,
      admission_date: createdAt,
      created_at: createdAt,
      ...(details.collegeName ? { college_name: details.collegeName } : {}),
    },
    update: {
      ...(!existing?.registration_number ? { registration_number: number } : {}),
      ...(!existing?.admission_date ? { admission_date: createdAt } : {}),
    },
  });
  if (!existing?.registration_number)
    await tx.audit_logs.create({
      data: {
        action: 'STUDENT_NUMBER_ALLOCATED',
        entity_type: 'student_profile',
        entity_id: actor.id,
        details: { registrationNumber: number },
      },
    });
}
