import { requireLeaveWorkspace } from '@/lib/server/leave-auth';
import { HR_ROLES, MANAGER_ROLES } from '@/lib/leave-roles';
import HRDashboard from '@/features/leave/components/hr-dashboard';
export const runtime = 'nodejs';

export default async function HRDashboardPage() {
  const actor = await requireLeaveWorkspace([...HR_ROLES, ...MANAGER_ROLES]);
  return <HRDashboard actor={actor} />;
}
