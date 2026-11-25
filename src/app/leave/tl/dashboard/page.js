import { requireLeaveWorkspace } from '@/lib/server/leave-auth';
import { TL_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
import TLDashboard from '@/features/leave/components/tl-dashboard';
export const runtime = 'nodejs';

export default async function TLDashboardPage() {
  const actor = await requireLeaveWorkspace([...TL_ROLES, ...MANAGER_ROLES]);
  return <TLDashboard actor={actor} />;
}
