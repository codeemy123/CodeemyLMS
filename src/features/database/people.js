'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import AccountMapping from '@/features/auth/components/account-mapping';
export default function DatabasePeople() {
  const { page, role } = useWorkspace();
  const [users, setUsers] = useState([]),
    [message, setMessage] = useState('');
  useEffect(() => {
    api('/api/people')
      .then((d) => setUsers(d.users))
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <>
      <section className="card" style={{ padding: 24 }}>
        <h2>{page}</h2>
        {users
          .filter((u) => u.role === (page === 'Students' ? 'STUDENT' : 'MENTOR'))
          .map((user) => (
            <div className="task-row" key={user.id}>
              <div>
                <h3>{user.full_name}</h3>
                <p>
                  {user.email} ? {user.status}
                </p>
              </div>
            </div>
          ))}
        {message && <p role="alert">{message}</p>}
        {!users.length && !message && <p>No assigned accounts yet.</p>}
      </section>
      {role === 'Admin' && <AccountMapping />}
    </>
  );
}
