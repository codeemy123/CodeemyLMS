import { config } from 'dotenv';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getPrisma } from '../src/lib/prisma.js';
import { ensureAcademicIdentity } from '../src/lib/server/academic-identity.js';
config({ path: ['.env.local', '.env'], quiet: true });
const db = getPrisma(),
  apply = process.argv.includes('--apply');
const auth = getAuth(
  initializeApp(
    { projectId: process.env.FIREBASE_PROJECT_ID, credential: applicationDefault() },
    'academic-backfill',
  ),
);
try {
  const [schema] = await db.$queryRawUnsafe(
    "SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='student_profiles' AND column_name='admission_date'",
  );
  if (schema?.data_type !== 'timestamp with time zone')
    throw Error('Complete the admission_date timestamp conversion first.');
  const users = await db.users.findMany({
    where: { role: { in: ['STUDENT', 'MENTOR'] } },
    select: { id: true, role: true, firebase_uid: true, created_at: true },
  });
  let fallback = 0;
  for (const user of users) {
    try {
      const identity = await auth.getUser(user.firebase_uid);
      user.accountCreatedAt = new Date(identity.metadata.creationTime);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      user.accountCreatedAt = user.created_at;
      fallback++;
    }
  }
  users.sort(
    (a, b) =>
      new Date(a.accountCreatedAt) - new Date(b.accountCreatedAt) || a.id.localeCompare(b.id),
  );
  if (apply)
    for (const user of users)
      await db.$transaction(async (tx) => {
        await ensureAcademicIdentity(tx, user, { createdAt: user.accountCreatedAt });
        if (user.role === 'STUDENT')
          await tx.student_profiles.update({
            where: { user_id: user.id },
            data: { admission_date: user.accountCreatedAt },
          });
        else
          await tx.mentor_profiles.update({
            where: { user_id: user.id },
            data: { created_at: user.accountCreatedAt },
          });
      });
  console.log(
    JSON.stringify({
      applied: apply,
      students: users.filter((u) => u.role === 'STUDENT').length,
      mentors: users.filter((u) => u.role === 'MENTOR').length,
      usedLmsCreationFallback: fallback,
    }),
  );
} finally {
  await db.$disconnect();
}
