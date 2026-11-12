export const metadata = { title: 'Mentor workspace · CodeEmy' };

// Mentor-only layout customization belongs here.
export default async function MentorLayout({ children }) {
  await requireWorkspaceRole('MENTOR');
  return children;
}
import { requireWorkspaceRole } from '@/lib/server/workspace-access';
export const runtime = 'nodejs';
