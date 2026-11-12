export const metadata = { title: 'Student workspace · CodeEmy' };

// Student-only layout customization belongs here.
// The parent workspace layout provides the shared sidebar/header and mock state.
export default async function StudentLayout({ children }) {
  await requireWorkspaceRole('STUDENT');
  return children;
}
import { requireWorkspaceRole } from '@/lib/server/workspace-access';
export const runtime = 'nodejs';
