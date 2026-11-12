'use client';
import AdminRecordActions from '@/features/management/components/admin-record-editor';

import { useEffect, useState } from 'react';
import { api } from './api';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import AccountMapping from '@/features/auth/components/account-mapping';
import AccountApprovals from '@/features/auth/components/account-approvals';
export default function DatabasePeople() {
  const { page, role } = useWorkspace();
  const [users, setUsers] = useState([]),
    [message, setMessage] = useState('');
  function refresh() {
    return api('/api/people')
      .then((d) => setUsers(d.users))
      .catch((e) => setMessage(e.message));
  }
  useEffect(() => {
    refresh();
  }, []);
  return (
    <>
      {role === 'Admin' && (
        <AccountApprovals
          key={page}
          roleFilter={page === 'Mentors' ? 'MENTOR' : 'STUDENT'}
          onReviewed={refresh}
        />
      )}
      <section className="card" style={{ padding: 24 }}>
        <h2>{page}</h2>
        {users
          .filter((u) => u.role === (page === 'Students' ? 'STUDENT' : 'MENTOR'))
          .map((user) => (
            <div className="task-row" key={user.id}>
              <div>
                <h3>{user.full_name}</h3>
                <p>
                  {user.email} &middot; {user.status}
                </p>
                {user.phone && <p>Phone: {user.phone}</p>}
              </div>
              <AdminRecordActions entity="people" record={user} onSaved={refresh} />
            </div>
          ))}
        {message && <p role="alert">{message}</p>}
        {!users.filter((u) => u.role === (page === 'Students' ? 'STUDENT' : 'MENTOR')).length &&
          !message && <p>No assigned accounts yet.</p>}
      </section>
      {role === 'Admin' && (
        <AccountMapping
          fixedRole={page === 'Mentors' ? 'MENTOR' : 'STUDENT'}
          onActivated={refresh}
        />
      )}
    </>
  );
}
