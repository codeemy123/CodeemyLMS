export const metadata = { title: 'Admin workspace · CodeEmy' };

// Admin-only layout customization belongs here.
export default async function AdminLayout({ children }) {
  await requireWorkspaceRole('ADMIN');
  return children;
}
import { requireWorkspaceRole } from '@/lib/server/workspace-access';
export const runtime = 'nodejs';
