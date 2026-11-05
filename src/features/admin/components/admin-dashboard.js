import AccountMapping from '@/features/auth/components/account-mapping';
import DashboardOverview from '@/features/dashboard/components/dashboard-overview';
import WorkspaceBackup from '@/features/management/components/workspace-backup';
// Role-specific dashboard entry. Customize admin widgets here.
export default function AdminDashboard() {
  return (
    <>
      <DashboardOverview />
      <WorkspaceBackup />
      <AccountMapping />
    </>
  );
}
