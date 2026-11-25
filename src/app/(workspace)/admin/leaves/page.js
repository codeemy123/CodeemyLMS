import AdminLeaveDashboard from '@/features/leave/components/admin-leave-dashboard';
import { requireWorkspaceRole } from '@/lib/server/workspace-access';
export const runtime = 'nodejs';

export default async function AdminLeavesPage() {
  const actor = await requireWorkspaceRole('ADMIN');
  return <AdminLeaveDashboard actor={actor} embedded />;
}
