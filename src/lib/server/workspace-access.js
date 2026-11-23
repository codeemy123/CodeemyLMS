import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

// Full Firebase + database verification stays in the Node server render, never Edge.
// React memoizes only within this server render, never across users/requests.
export const requireWorkspaceRole = cache(async function requireWorkspaceRole(role) {
  if (process.env.LMS_AUTH_ENABLED === 'false' && process.env.NODE_ENV !== 'production') return;
  let actor;
  try {
    const cookieStore = await cookies();
    const { requireActor } = await import('./auth');
    actor = await requireActor({ cookies: cookieStore, headers: new Headers() });
  } catch {
    redirect('/login');
  }
  if (actor.role !== role) redirect('/' + actor.role.toLowerCase() + '/dashboard');
  return actor;
});
