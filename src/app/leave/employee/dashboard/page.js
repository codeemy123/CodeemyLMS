import { requireLeaveWorkspace } from '@/lib/server/leave-auth';
import { ALL_VALID_LEAVE_ROLES } from '@/lib/leave-roles';
import EmployeeDashboard from '@/features/leave/components/employee-dashboard';
export const runtime = 'nodejs';

export default async function EmployeeDashboardPage() {
  const actor = await requireLeaveWorkspace(ALL_VALID_LEAVE_ROLES);
  return <EmployeeDashboard actor={actor} />;
}
