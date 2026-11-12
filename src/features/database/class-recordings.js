'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function ClassRecordings({ classId }) {
  const { role } = useWorkspace();
  const [meetings, setMeetings] = useState([]),
    [hostEmail, setHostEmail] = useState(''),
    [cursor, setCursor] = useState(null);
  async function findMeetings(next = null) {
    setBusy(true);
    try {
      const query = new URLSearchParams({
        ...(hostEmail ? { hostEmail } : {}),
        ...(next ? { cursor: next } : {}),
      });
      const data = await api('/api/zoom/meetings?' + query);
      setMeetings((old) => (next ? [...old, ...data.meetings] : data.meetings));
      setCursor(data.nextCursor);
      setMessage(
        data.meetings.length ? '' : 'No completed cloud recordings found in the last 30 days.',
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  const [rows, setRows] = useState([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      setRows((await api('/api/class-recordings?classId=' + classId)).recordings);
    } catch (e) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [classId]);
  async function save(body) {
    setBusy(true);
    try {
      await api('/api/class-recordings', {
        method: 'POST',
        body: JSON.stringify({ classId, ...body }),
      });
      setMessage('Recording updated.');
      await refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h4>Class recordings</h4>
      {role !== 'Student' && (
        <details>
          <summary>Connect a completed Zoom class</summary>
          {role === 'Admin' && (
            <label>
              Zoom host email
              <input
                type="email"
                value={hostEmail}
                onChange={(e) => setHostEmail(e.target.value)}
                placeholder="mentor@example.com"
              />
            </label>
          )}
          <button type="button" disabled={busy} onClick={() => findMeetings()}>
            Find Zoom recordings
          </button>
          {cursor && (
            <button type="button" disabled={busy} onClick={() => findMeetings(cursor)}>
              Load more recordings
            </button>
          )}
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              save({ action: 'sync', meetingUuid: new FormData(e.currentTarget).get('uuid') });
            }}
          >
            <label>
              Completed class
              <select name="uuid" required>
                <option value="">Choose the recording for this class</option>
                {meetings.map((m) => (
                  <option key={m.uuid} value={m.uuid}>
                    {m.title} · {new Date(m.startAt).toLocaleString()} · {m.duration} min
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy}>Sync recording</button>
          </form>
        </details>
      )}
      <p role="status">{message}</p>
      {rows.map((r) => (
        <div key={r.id}>
          <p>{r.status.replaceAll('_', ' ')}</p>
          {r.url ? (
            <video style={{ width: '100%', maxHeight: 400 }} controls preload="none" src={r.url} />
          ) : (
            role !== 'Student' &&
            ['WAITING_PUBLISH', 'FAILED'].includes(r.status) && (
              <button disabled={busy} onClick={() => save({ action: 'publish', id: r.id })}>
                {r.status === 'FAILED' ? 'Retry publish' : 'Publish to students'}
              </button>
            )
          )}
          {role !== 'Student' && r.last_error && <p>{r.last_error}</p>}
        </div>
      ))}
    </section>
  );
}
