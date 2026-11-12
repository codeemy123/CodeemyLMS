import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireActor } from './auth';

// Full Firebase + database verification stays in the Node server render, never Edge.
export async function requireWorkspaceRole(role) {
  if (process.env.LMS_AUTH_ENABLED === 'false' && process.env.NODE_ENV !== 'production') return;
  let actor;
  try {
    actor = await requireActor({ cookies: await cookies(), headers: new Headers() });
  } catch {
    redirect('/login');
  }
  if (actor.role !== role) redirect('/' + actor.role.toLowerCase() + '/dashboard');
  return actor;
}
