'use client';
import { useEffect, useState } from 'react';
import { api } from './api';
export function AssessmentAccessRequest({ attemptId, request, onSaved }) {
  const [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const activeGrant =
    request?.status === 'APPROVED' && !request.used && new Date(request.closeAt) > new Date();
  return (
    <section className="assessment-access-box">
      <h3>Need another attempt?</h3>
      <p>This assessment allows one attempt. Send your reason to the academy Admin for review.</p>
      {request?.status === 'PENDING' ? (
        <p role="status">Your request is awaiting Admin approval.</p>
      ) : activeGrant ? (
        <p role="status">
          Approved. Return to the assessment list to start within your approved access window.
        </p>
      ) : (
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage('');
            try {
              await api('/api/assessment-reopens', {
                method: 'POST',
                body: JSON.stringify({ attemptId, reason }),
              });
              setReason('');
              setMessage('Request sent to Admin.');
              await onSaved();
            } catch (err) {
              setMessage(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {request?.status === 'REJECTED' && <p>Admin response: {request.reviewReason}</p>}
          <label>
            Reason for another attempt
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={2000}
              placeholder="Explain what happened and why you need access again."
            />
          </label>
          <button className="btn" disabled={busy}>
            {busy ? 'Sending…' : 'Request Admin approval'}
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export default function AssessmentAccessReviews() {
  const [rows, setRows] = useState([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      setRows((await api('/api/assessment-reopens')).requests);
    } catch (e) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);
  function localTime(offset = 0) {
    const d = new Date(Date.now() + offset);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return (
    <section className="card workflow-card">
      <h2>Assessment access requests</h2>
      <p>
        Review the student’s reason and grant one new attempt within a specific date/time window.
        Previous attempts and marks remain in history.
      </p>
      {message && <p role="status">{message}</p>}
      {!rows.length && <p>No assessment access requests yet.</p>}
      {rows.map((r) => (
        <article key={r.id} className="assessment-access-box">
          <h3>{r.assessmentTitle}</h3>
          <p>
            <strong>{r.student?.full_name || 'Student'}</strong> · {r.student?.email}
          </p>
          <p>Request: {r.reason}</p>
          <p>Previous attempt closed: {r.closedReason}</p>
          <p>
            Status: {r.status}
            {r.used ? ' · Access used' : ''}
          </p>
          {r.status === 'PENDING' ? (
            <form
              className="auth-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget),
                  decision = e.nativeEvent.submitter?.value || 'APPROVED';
                setBusy(true);
                try {
                  await api('/api/assessment-reopens', {
                    method: 'PATCH',
                    body: JSON.stringify({
                      requestId: r.id,
                      decision,
                      reason: form.get('reason'),
                      openAt: new Date(form.get('openAt')).toISOString(),
                      closeAt: new Date(form.get('closeAt')).toISOString(),
                    }),
                  });
                  setMessage('Access request reviewed. Student notified.');
                  await refresh();
                } catch (err) {
                  setMessage(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="registration-fields">
                <label>
                  Access opens
                  <input name="openAt" type="datetime-local" defaultValue={localTime()} required />
                </label>
                <label>
                  Access closes
                  <input
                    name="closeAt"
                    type="datetime-local"
                    defaultValue={localTime(3600000)}
                    required
                  />
                </label>
              </div>
              <label>
                Review note
                <textarea
                  name="reason"
                  maxLength={2000}
                  placeholder="Required when rejecting a request."
                />
              </label>
              <div className="profile-photo-actions">
                <button className="btn" name="decision" value="APPROVED" disabled={busy}>
                  Approve one attempt
                </button>
                <button className="btn secondary" name="decision" value="REJECTED" disabled={busy}>
                  Reject request
                </button>
              </div>
            </form>
          ) : (
            <p>{r.reviewReason}</p>
          )}
        </article>
      ))}
    </section>
  );
}
