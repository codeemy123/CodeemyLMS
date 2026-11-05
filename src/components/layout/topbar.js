'use client';
import { Bell, Menu, X, Search, ChevronDown } from 'lucide-react';
import { navigation } from '@/config/navigation';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function Topbar() {
  const { role, mobile, setMobile, read, notify, go, records, actor } = useWorkspace();
  const name = actor?.full_name || 'Account';
  return (
    <header className="topbar">
      <button
        className="mobile-menu"
        aria-label="Toggle navigation"
        onClick={() => setMobile((v) => !v)}
      >
        {mobile ? <X /> : <Menu />}
      </button>
      <div className="topbar-title">
        <span className="header-dot" /> CodeEmy <span className="header-divider">/</span>
        <span className="header-role">{role} workspace</span>
      </div>
      <div className="top-right">
        <form
          className="workspace-search"
          onSubmit={(e) => {
            e.preventDefault();
            const val = new FormData(e.currentTarget).get('search');
            const found = navigation[role].find(([n]) =>
              n.toLowerCase().includes(String(val).toLowerCase()),
            );
            found ? go(found[0]) : notify('No page found. Try courses, classes or assignments.');
          }}
        >
          <Search size={16} aria-hidden="true" />
          <input
            className="global-search"
            name="search"
            aria-label="Search workspace pages"
            placeholder="Search your workspace…"
            required
          />
        </form>
        <button
          className="notification-button"
          aria-label="Notifications"
          onClick={() => go('Notifications')}
        >
          <Bell size={19} />
          {!read && <i />}
        </button>
        <button className="user profile-button" onClick={() => go('Profile')}>
          <div className="avatar">
            {actor?.profile_image ? (
              <img
                className="profile-avatar-image"
                src={actor?.profile_image}
                alt="Your profile picture"
              />
            ) : (
              name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
            )}
          </div>
          <div>
            {actor?.full_name || name}
            <small>{role}</small>
          </div>
          <ChevronDown size={13} className="profile-chevron" />
        </button>
      </div>
    </header>
  );
}
