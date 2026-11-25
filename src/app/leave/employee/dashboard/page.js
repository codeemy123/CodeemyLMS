import { requireLeaveWorkspace } from '@/lib/server/leave-auth';
import EmployeeDashboard from '@/features/leave/components/employee-dashboard';
export const runtime = 'nodejs';

export default async function EmployeeDashboardPage() {
  const actor = await requireLeaveWorkspace([
    'TRAINING_INTERN',
    'INTERN',
    'FULLTIME',
    'EMPLOYEE',
    'TEAM_LEADER',
    'HR',
    'MANAGER',
    'ADMIN',
  ]);
  return <EmployeeDashboard actor={actor} />;
}
