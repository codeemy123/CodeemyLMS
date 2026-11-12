import WorkspaceLayout from '@/components/layout/workspace-layout';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireWorkspaceRole } from '@/lib/server/workspace-access';
export const runtime = 'nodejs';
export default async function Layout({ children }) {
  const role = (await headers()).get('x-codeemy-workspace')?.toUpperCase();
  if (!['ADMIN', 'MENTOR', 'STUDENT'].includes(role)) redirect('/login');
  const actor = await requireWorkspaceRole(role);
  return <WorkspaceLayout initialActor={actor || null}>{children}</WorkspaceLayout>;
}
