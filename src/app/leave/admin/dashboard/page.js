import { requireLeaveWorkspace } from '@/lib/server/leave-auth';
import AdminLeaveDashboard from '@/features/leave/components/admin-leave-dashboard';
export const runtime = 'nodejs';

export default async function AdminLeaveDashboardPage() {
  const actor = await requireLeaveWorkspace(['MANAGER', 'ADMIN']);
  return <AdminLeaveDashboard actor={actor} />;
}
