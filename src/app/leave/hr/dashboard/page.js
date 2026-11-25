import { requireLeaveWorkspace } from '@/lib/server/leave-auth';
import HRDashboard from '@/features/leave/components/hr-dashboard';
export const runtime = 'nodejs';

export default async function HRDashboardPage() {
  const actor = await requireLeaveWorkspace(['HR', 'MANAGER', 'ADMIN']);
  return <HRDashboard actor={actor} />;
}
