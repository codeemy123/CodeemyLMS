'use client';
import { Bell } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function NotificationList() {
  const { read, setRead, notify, go, notifications, unreadCount, readIds, notificationError } =
    useWorkspace();
  return (
    <div className="card">
      {notificationError && <p role="alert">{notificationError}</p>}
      <div className="section-head">
        <h2>{read ? 'All caught up' : `${unreadCount} new notifications`}</h2>
        <Button
          secondary
          onClick={() => {
            setRead();
          }}
        >
          Mark all as read
        </Button>
      </div>
      {notifications.map(({ id, title, description, page, detail }) => (
        <div className="task-row" key={id}>
          <Bell size={18} />
          <div className="task-info">
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          {!readIds.includes(id) && (
            <>
              <Badge>New</Badge>
              <Button secondary onClick={() => setRead(id)}>
                Mark as read
              </Button>
            </>
          )}
          {page !== 'Notifications' && (
            <Button
              secondary
              onClick={() => {
                setRead(id);
                go(page, detail);
              }}
            >
              View
            </Button>
          )}
        </div>
      ))}
      {!notifications.length && (
        <p>No updates yet. Published announcements and workflow replies appear here.</p>
      )}
    </div>
  );
}
