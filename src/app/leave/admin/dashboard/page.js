import { requireLeaveWorkspace } from '@/lib/server/leave-auth';
import { MANAGER_ROLES } from '@/lib/leave-roles';
import AdminLeaveDashboard from '@/features/leave/components/admin-leave-dashboard';
export const runtime = 'nodejs';

export default async function AdminLeaveDashboardPage() {
  const actor = await requireLeaveWorkspace(MANAGER_ROLES);
  return <AdminLeaveDashboard actor={actor} />;
}
