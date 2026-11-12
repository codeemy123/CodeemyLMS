import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Full Firebase + database verification stays in the Node server render, never Edge.
export async function requireWorkspaceRole(role) {
  if (process.env.LMS_AUTH_ENABLED === 'false' && process.env.NODE_ENV !== 'production') return;
  let actor;
  try {
    const cookieStore = await cookies();
    if (process.env.LMS_BACKEND_ORIGIN) {
      const session = cookieStore.get('codeemy_session')?.value;
      if (!session) throw new Error('Missing session');
      const response = await fetch(new URL('/api/auth/me', process.env.LMS_BACKEND_ORIGIN), {
        headers: { cookie: 'codeemy_session=' + session },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Invalid backend session');
      actor = (await response.json()).user;
      if (!actor || !['ADMIN', 'MENTOR', 'STUDENT'].includes(actor.role))
        throw new Error('Invalid backend role');
    } else {
      const { requireActor } = await import('./auth');
      actor = await requireActor({ cookies: cookieStore, headers: new Headers() });
    }
  } catch {
    redirect('/login');
  }
  if (actor.role !== role) redirect('/' + actor.role.toLowerCase() + '/dashboard');
  return actor;
}
