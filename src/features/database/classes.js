'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function DatabaseClasses() {
  const { role } = useWorkspace();
  const [batches, setBatches] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (role === 'Admin')
      api('/api/batches')
        .then((d) => setBatches(d.batches))
        .catch((e) => setMessage(e.message));
  }, [role]);
  const [sessions, setSessions] = useState([]),
    [message, setMessage] = useState('');
  useEffect(() => {
    api('/api/class-sessions')
      .then((d) => setSessions(d.sessions))
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <section className="card" style={{ padding: 24 }}>
      <h2>Your classes</h2>
      {role === 'Admin' && (
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = Object.fromEntries(new FormData(form));
            data.startAt = new Date(data.startAt).toISOString();
            setBusy(true);
            try {
              await api('/api/class-sessions', { method: 'POST', body: JSON.stringify(data) });
              setSessions((await api('/api/class-sessions')).sessions);
              form.reset();
              setMessage('Class scheduled and participants notified.');
            } catch (e) {
              setMessage(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Class title
            <input name="title" required maxLength={255} />
          </label>
          <label>
            Batch
            <select name="batchId" required>
              <option value="">Choose batch</option>
              {batches.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start time
            <input type="datetime-local" name="startAt" required />
          </label>
          <label>
            Meeting URL
            <input type="url" name="meetingUrl" placeholder="https://" />
          </label>
          <button disabled={busy}>Schedule class</button>
        </form>
      )}
      {message && <p role="alert">{message}</p>}
      {sessions.map((session) => (
        <article className="task-row" key={session.id}>
          <div>
            <h3>{session.title}</h3>
            <p>
              {session.batches.name} ? {new Date(session.start_at).toLocaleString()}
            </p>
            {session.meeting_url && session.meeting_url.startsWith('https://') && (
              <a href={session.meeting_url} target="_blank" rel="noreferrer">
                Join class
              </a>
            )}
          </div>
        </article>
      ))}
      {!sessions.length && !message && <p>No classes scheduled.</p>}
    </section>
  );
}
