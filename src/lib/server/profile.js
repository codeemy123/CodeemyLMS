export async function profileDetails(db, actor) {
  let collegeName = false;
  if (actor.role === 'STUDENT') {
    const [schema] = await db.$queryRawUnsafe(
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student_profiles' AND column_name='college_name') AS available",
    );
    collegeName = schema.available;
  }
  const user = await db.users.findUnique({
    where: { id: actor.id },
    select: {
      id: true,
      full_name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      profile_image: true,
      created_at: true,
      ...(actor.role === 'STUDENT'
        ? {
            student_profiles: {
              select: {
                qualification: true,
                department: true,
                registration_number: true,
                admission_date: true,
                ...(collegeName ? { college_name: true } : {}),
              },
            },
          }
        : {}),
      ...(actor.role === 'MENTOR' ? { mentor_profiles: true } : {}),
    },
  });
  return { user, capabilities: { collegeName } };
}
