import WorkspaceLayout from '@/components/layout/workspace-layout';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireWorkspaceRole } from '@/lib/server/workspace-access';
export const runtime = 'nodejs';
export default async function Layout({ children }) {
  const allHeaders = await headers();
  let role = allHeaders.get('x-codeemy-workspace')?.toUpperCase();
  if (!['ADMIN', 'MENTOR', 'STUDENT'].includes(role)) {
    const matched = allHeaders.get('x-matched-path') || allHeaders.get('next-url') || '';
    if (matched.includes('/mentor')) role = 'MENTOR';
    else if (matched.includes('/student')) role = 'STUDENT';
    else role = 'ADMIN';
  }
  const actor = await requireWorkspaceRole(role);
  return <WorkspaceLayout initialActor={actor || null}>{children}</WorkspaceLayout>;
}
