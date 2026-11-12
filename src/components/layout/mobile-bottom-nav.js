'use client';
import Link from 'next/link';
import { House, BookOpen, CalendarDays, UserRound, Users, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { workspaceHref } from '@/lib/routes';

const menus = {
  Student: [
    ['Dashboard', 'Home', House],
    ['My Courses', 'My Courses', BookOpen],
    ['Classes', 'Classes', CalendarDays],
    ['Profile', 'Profile', UserRound],
  ],
  Mentor: [
    ['Dashboard', 'Home', House],
    ['Students', 'Students', Users],
    ['Classes', 'Classes', CalendarDays],
    ['Profile', 'Profile', UserRound],
  ],
  Admin: [
    ['Dashboard', 'Home', House],
    ['Account Approvals', 'Approvals', ShieldCheck],
    ['Courses', 'Courses', BookOpen],
    ['Profile', 'Profile', UserRound],
  ],
};
export default function MobileBottomNav() {
  const { role, page, go, approvalCount, mobile } = useWorkspace();
  return (
    <nav
      className="mobile-bottom-nav"
      aria-label={role + ' quick navigation'}
      inert={mobile || undefined}
    >
      {(menus[role] || []).map(([target, label, Icon]) => (
        <Link
          key={target}
          href={workspaceHref(role, target)}
          prefetch={false}
          aria-current={page === target ? 'page' : undefined}
          onNavigate={(event) => {
            event.preventDefault();
            go(target);
          }}
        >
          <span className="bottom-nav-icon">
            <Icon size={22} />
            {target === 'Account Approvals' && approvalCount > 0 && (
              <i aria-label={approvalCount + ' pending approvals'} />
            )}
          </span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
