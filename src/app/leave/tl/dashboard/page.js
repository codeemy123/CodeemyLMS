import { requireLeaveWorkspace } from '@/lib/server/leave-auth';
import TLDashboard from '@/features/leave/components/tl-dashboard';
export const runtime = 'nodejs';

export default async function TLDashboardPage() {
  const actor = await requireLeaveWorkspace(['TEAM_LEADER', 'ADMIN']);
  return <TLDashboard actor={actor} />;
}
