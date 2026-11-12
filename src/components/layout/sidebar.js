'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { navigation } from '@/config/navigation';
import { workspaceHref } from '@/lib/routes';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
function NavigationLink({ onNavigate, children, ...props }) {
  const [prefetch, setPrefetch] = useState(false);
  return (
    <Link
      {...props}
      prefetch={prefetch}
      onMouseEnter={() => setPrefetch(true)}
      onFocus={() => setPrefetch(true)}
      onTouchStart={() => setPrefetch(true)}
      onNavigate={onNavigate}
    >
      {children}
    </Link>
  );
}
export default function Sidebar() {
  const { role, page, mobile, unreadCount, approvalCount, go, changeRole, signOut } =
    useWorkspace();
  return (
    <aside className={'sidebar ' + (mobile ? 'open' : '')}>
      <NavigationLink
        className="brand"
        href={workspaceHref(role, 'Dashboard')}
        onNavigate={(e) => {
          e.preventDefault();
          go('Dashboard');
        }}
      >
        <Image
          className="sidebar-logo"
          src="/codeemy-technologies.png"
          alt="CodeEmy Technologies"
          width={900}
          height={330}
          loading="eager"
          unoptimized
        />
      </NavigationLink>
      <div className="workspace">{role.toUpperCase()} WORKSPACE</div>
      <nav className="nav" aria-label={role + ' navigation'}>
        {navigation[role].map(([n, Icon]) => (
          <NavigationLink
            key={n}
            href={workspaceHref(role, n)}
            className={page === n ? 'active' : ''}
            aria-current={page === n ? 'page' : undefined}
            onNavigate={(e) => {
              e.preventDefault();
              go(n);
            }}
          >
            <Icon size={17} />
            {n}
            {n === 'Account Approvals' && approvalCount > 0 && (
              <span className="nav-count">{approvalCount}</span>
            )}
            {n === 'Notifications' && unreadCount > 0 && (
              <span className="nav-count">{unreadCount}</span>
            )}
          </NavigationLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="workspace">{role} account</span>
        <button className="text-link" style={{ marginTop: 12 }} onClick={signOut}>
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  );
}
