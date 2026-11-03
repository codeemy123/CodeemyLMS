'use client';
import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { navigation } from '@/config/navigation';
import { workspaceHref } from '@/lib/routes';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function Sidebar() {
  const { role, page, mobile, unreadCount, go, changeRole, signOut } = useWorkspace();
  return (
    <aside className={'sidebar ' + (mobile ? 'open' : '')}>
      <a
        className="brand"
        href={workspaceHref(role, 'Dashboard')}
        onClick={(e) => {
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
      </a>
      <div className="workspace">{role.toUpperCase()} WORKSPACE</div>
      <nav className="nav" aria-label={role + ' navigation'}>
        {navigation[role].map(([n, Icon]) => (
          <a
            key={n}
            href={workspaceHref(role, n)}
            className={page === n ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              go(n);
            }}
          >
            <Icon size={17} />
            {n}
            {n === 'Notifications' && unreadCount > 0 && (
              <span className="nav-count">{unreadCount}</span>
            )}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <select
          className="role"
          aria-label="Switch preview role"
          value={role}
          onChange={(e) => changeRole(e.target.value)}
        >
          {Object.keys(navigation).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <button className="text-link" style={{ marginTop: 12 }} onClick={signOut}>
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  );
}
