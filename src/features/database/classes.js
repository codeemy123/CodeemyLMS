'use client';
import AdminRecordActions from '@/features/management/components/admin-record-editor';
import ClassRecordings from './class-recordings';
import { CalendarDays, Plus, Video } from 'lucide-react';

import { useEffect, useState } from 'react';
import { api } from './api';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function DatabaseClasses({ mode = 'class' }) {
  const { role, go } = useWorkspace();
  const sessionLabel = mode === 'webinar' ? 'webinar' : mode === 'live' ? 'live class' : 'class';
  const sessionLabelTitle = sessionLabel[0].toUpperCase() + sessionLabel.slice(1);
  const sessionLabelPlural = mode === 'webinar' ? 'webinars' : mode === 'live' ? 'live classes' : 'classes';
  const [loading, setLoading] = useState(true),
    [batchesLoading, setBatchesLoading] = useState(role === 'Admin');
  const [batches, setBatches] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (role === 'Admin')
      api('/api/batches')
        .then((d) => setBatches(d.batches))
        .catch((e) => setMessage(e.message))
        .finally(() => setBatchesLoading(false));
  }, [role]);
  const [sessions, setSessions] = useState([]),
    [message, setMessage] = useState('');
  useEffect(() => {
    api('/api/class-sessions')
      .then((d) => setSessions(d.sessions))
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <section className="card class-management">
      <div className="class-section-heading">
        <span className="class-heading-icon">
          <CalendarDays size={25} />
        </span>
        <div>
          <h2>{role === 'Admin' ? `Schedule and manage ${sessionLabelPlural}` : 'Your classes'}</h2>
          <p>
            {role === 'Admin'
              ? `Plan a ${sessionLabel}, choose its batch and share the meeting link.`
              : 'Your assigned classroom sessions and recordings, in one place.'}
          </p>
        </div>
      </div>
      {role === 'Admin' && (
        <form
          className="auth-form class-schedule-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = Object.fromEntries(new FormData(form));
            setBusy(true);
            try {
              data.startAt = new Date(data.startAt).toISOString();
              await api('/api/class-sessions', { method: 'POST', body: JSON.stringify(data) });
              setSessions((await api('/api/class-sessions')).sessions);
              form.reset();
              setMessage(`${sessionLabelTitle} scheduled and participants notified.`);
            } catch (e) {
              setMessage(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {sessionLabelTitle} title
            <input name="title" required maxLength={255} placeholder="e.g. Python fundamentals" />
          </label>
          <label>
            Batch
            <select
              aria-label="Batch"
              name="batchId"
              required
              disabled={busy || batchesLoading || !batches.length}
            >
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
            <small>Enter your device’s local time. Sessions are displayed in IST.</small>
          </label>
          <label>
            Meeting URL
            <input type="url" name="meetingUrl" placeholder="https://" />
          </label>
          {batchesLoading && <p role="status">Loading batches…</p>}
          {!batchesLoading && !batches.length && (
            <div className="class-prerequisite">
              <p>Create a batch before scheduling its first class.</p>
              <button type="button" className="btn secondary" onClick={() => go('Batches')}>
                Manage batches
              </button>
            </div>
          )}
          <div className="class-form-actions">
            <p>Batch members will be notified when the class is scheduled.</p>
            <button
              className="btn"
              type="submit"
              disabled={busy || batchesLoading || !batches.length}
            >
              <Plus size={17} />
              {busy ? 'Scheduling…' : `Schedule ${sessionLabel}`}
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className="class-notice" role="status">
          {message}
        </p>
      )}
      <div className="class-list-heading">
        <h3>Scheduled {sessionLabelPlural}</h3>
        <span>{sessions.length} sessions</span>
      </div>
      {loading && <p role="status">Loading {sessionLabelPlural}…</p>}
      {sessions.map((session) => (
        <article className="class-session-card" key={session.id}>
          <div>
            <h3>{session.title}</h3>
            <AdminRecordActions
              entity="classes"
              record={session}
              onSaved={async () => setSessions((await api('/api/class-sessions')).sessions)}
            />
            <p>
              {session.batches.name} &middot;{' '}
              {new Date(session.start_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </p>
            {session.meeting_url && session.meeting_url.startsWith('https://') && (
              <a
                className="btn secondary"
                href={session.meeting_url}
                target="_blank"
                rel="noreferrer"
              >
                <Video size={17} /> Join class
              </a>
            )}
            <ClassRecordings classId={session.id} />
          </div>
        </article>
      ))}
      {!loading && !sessions.length && (
        <div className="class-empty">
          <CalendarDays size={32} />
          <h3>No {sessionLabelPlural} scheduled yet</h3>
          <p>
            {role === 'Admin'
              ? `Your sessions will appear here after you schedule a ${sessionLabel}.`
              : 'Your academy will share upcoming sessions here.'}
          </p>
        </div>
      )}
    </section>
  );
}
