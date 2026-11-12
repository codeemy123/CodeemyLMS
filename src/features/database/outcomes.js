'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function DatabaseOutcomes({ kind }) {
  const { role } = useWorkspace();
  const [records, setRecords] = useState([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const data = await api('/api/' + kind);
      setRecords(data.certificates || data.opportunities);
    } catch (e) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, [kind]);
  async function save(body) {
    setBusy(true);
    try {
      await api('/api/' + kind, { method: 'POST', body: JSON.stringify(body) });
      await refresh();
      setMessage('Saved successfully.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <p role="status">{message}</p>
      {records.map((r) => (
        <article key={r.id} className="card workflow-card">
          <h2>{kind === 'certificates' ? r.courses.title : r.title}</h2>
          {kind === 'certificates' ? (
            <>
              <p>{r.users.full_name}</p>
              <p>
                {r.certificate_number} · {r.revoked ? 'Revoked' : 'Issued'}
              </p>
              {!r.revoked && (
                <a href={'/api/certificates/' + r.id + '/download'}>Download certificate PDF</a>
              )}
              {role === 'Admin' && (
                <form
                  className="auth-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save({ id: r.id, ...Object.fromEntries(new FormData(e.currentTarget)) });
                  }}
                >
                  <label>
                    Action
                    <select name="action">
                      <option value="revoke">Revoke</option>
                      <option value="reissue">Reissue</option>
                    </select>
                  </label>
                  <label>
                    Reason
                    <textarea name="reason" required maxLength={2000} />
                  </label>
                  <button disabled={busy}>Update certificate</button>
                </form>
              )}
              {r.history.map((h, i) => (
                <p key={i}>
                  {h.action} · {new Date(h.created_at).toLocaleString()} · {h.reason}
                </p>
              ))}
            </>
          ) : (
            <>
              <p>{r.description}</p>
              <a href={r.file_url} target="_blank" rel="noreferrer">
                Opportunity details
              </a>
              {role === 'Student' && !r.career_applications.length && (
                <form
                  className="auth-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save({ id: r.id, note: new FormData(e.currentTarget).get('note') });
                  }}
                >
                  <label>
                    Application note
                    <textarea name="note" maxLength={10000} />
                  </label>
                  <button disabled={busy}>Apply through academy</button>
                </form>
              )}
              {r.career_applications.map((a) => (
                <section key={a.id}>
                  <h3>{a.users.full_name}</h3>
                  <p>{a.status}</p>
                  <p>{a.cover_note}</p>
                  <p>{a.feedback}</p>
                  {role === 'Admin' ? (
                    <form
                      className="auth-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        save({ id: a.id, ...Object.fromEntries(new FormData(e.currentTarget)) });
                      }}
                    >
                      <label>
                        Status
                        <select name="status">
                          <option>REVIEWING</option>
                          <option>ACCEPTED</option>
                          <option>REJECTED</option>
                        </select>
                      </label>
                      <label>
                        Feedback
                        <textarea name="feedback" />
                      </label>
                      <button disabled={busy}>Update application</button>
                    </form>
                  ) : (
                    ['APPLIED', 'REVIEWING'].includes(a.status) && (
                      <button
                        disabled={busy}
                        onClick={() => save({ id: a.id, action: 'withdraw' })}
                      >
                        Withdraw application
                      </button>
                    )
                  )}
                </section>
              ))}
            </>
          )}
        </article>
      ))}
      {!records.length && (
        <section className="card empty">
          <h2>No {kind} yet</h2>
          <p>Your available records will appear here.</p>
        </section>
      )}
    </section>
  );
}
