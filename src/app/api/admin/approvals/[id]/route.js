import { authenticated } from '@/lib/server/auth';
import { jsonBody, roleAllowed } from '@/lib/server/api';
import { firebaseAuth } from '@/lib/server/firebase';
import { reviewRegistration } from '@/lib/server/registrations';
export const runtime = 'nodejs';
export const POST = authenticated(async (request, context, actor, db) => {
  roleAllowed(actor, ['ADMIN']);
  return reviewRegistration(db, actor, (await context.params).id, await jsonBody(request), (uid) =>
    firebaseAuth().getUser(uid),
  );
});
