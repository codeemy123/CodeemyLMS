'use client';
import { useState, useEffect, useCallback } from 'react';
import { Users, Clock, CheckCircle2, XCircle, LogOut, ChevronDown } from 'lucide-react';

const STATUS_LABELS = {
  PENDING_TL: 'Waiting for TL', PENDING_HR: 'Approved by TL → HR',
  PENDING_ADMIN: 'Approved by HR → Admin', APPROVED: 'Approved', REJECTED: 'Rejected',
};

function ReviewModal({ leave, onClose, onDone }) {
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!action) { setError('Select Approve or Reject.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/leave/${leave.id}/tl-action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed.'); setBusy(false); return; }
      onDone();
    } catch { setError('Network error.'); setBusy(false); }
  }

  return (
    <div className="leave-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="leave-modal">
        <div className="leave-modal-header">
          <h2>Review Leave — {leave.employee?.full_name}</h2>
          <button type="button" className="leave-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="leave-detail">
          <div className="leave-detail-row"><span>Type</span><span className="leave-type-chip">{leave.leave_type}</span></div>
          <div className="leave-detail-row"><span>Dates</span><span>{new Date(leave.from_date).toLocaleDateString('en-IN')} → {new Date(leave.to_date).toLocaleDateString('en-IN')}</span></div>
          <div className="leave-detail-row"><span>Subject</span><strong>{leave.subject}</strong></div>
          <p className="leave-reason-text">{leave.reason}</p>
          {leave.document_url && <a href={leave.document_url} target="_blank" rel="noreferrer" className="leave-doc-link">📎 View Document</a>}
          <div className="leave-review-actions">
            <button className={`leave-action-btn approve ${action === 'APPROVE' ? 'selected' : ''}`} onClick={() => setAction('APPROVE')}>✓ Approve</button>
            <button className={`leave-action-btn reject ${action === 'REJECT' ? 'selected' : ''}`} onClick={() => setAction('REJECT')}>✗ Reject</button>
          </div>
          <label className="leave-field">
            <span>Note / Comment (optional)</span>
            <textarea rows={3} placeholder="Add a note for the employee…" value={note} onChange={e => setNote(e.target.value)} />
          </label>
          {error && <p className="leave-error" role="alert">{error}</p>}
          <div className="leave-form-actions">
            <button type="button" className="leave-btn secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="leave-btn primary" onClick={submit} disabled={busy || !action}>{busy ? 'Saving…' : 'Submit Review'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TLDashboard({ actor }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/leave/pending/tl', { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); setLeaves(d.leaves || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function signout() {
    await fetch('/api/leave/session', { method: 'DELETE' });
    window.location.assign('/leave/login');
  }

  return (
    <div className="leave-shell">
      <header className="leave-topbar">
        <div className="leave-topbar-brand">
          <img src="/codeemy-technologies.png" alt="CodeEmy" width={120} />
          <span className="leave-role-chip tl">Team Leader</span>
        </div>
        <div className="leave-topbar-right">
          <span className="leave-user-name">👤 {actor.full_name}</span>
          <button className="leave-signout-btn" onClick={signout}><LogOut size={15} /> Sign out</button>
        </div>
      </header>

      <main className="leave-main">
        <div className="leave-page-header">
          <div>
            <h1>Team Leave Requests</h1>
            <p>Review and approve your team members' pending leave applications.</p>
          </div>
          <div className="leave-count-badge">{leaves.length} Pending</div>
        </div>

        {loading ? (
          <div className="leave-loading">Loading pending leaves…</div>
        ) : leaves.length === 0 ? (
          <div className="leave-empty">
            <CheckCircle2 size={48} color="#10b981" />
            <p>All caught up! No pending leave requests.</p>
          </div>
        ) : (
          <div className="leave-cards-grid">
            {leaves.map(l => (
              <div key={l.id} className="leave-review-card">
                <div className="leave-review-card-header">
                  <div className="leave-emp-avatar">{l.employee?.full_name?.[0]?.toUpperCase()}</div>
                  <div>
                    <strong>{l.employee?.full_name}</strong>
                    <small>{l.employee?.department || l.employee?.email}</small>
                  </div>
                  <span className="leave-type-chip">{l.leave_type}</span>
                </div>
                <div className="leave-review-card-body">
                  <p className="leave-review-subject">{l.subject}</p>
                  <div className="leave-review-dates">
                    <Clock size={13} /> {new Date(l.from_date).toLocaleDateString('en-IN')} → {new Date(l.to_date).toLocaleDateString('en-IN')}
                  </div>
                  <p className="leave-review-reason">{l.reason.slice(0, 120)}{l.reason.length > 120 ? '…' : ''}</p>
                </div>
                <div className="leave-review-card-footer">
                  <small>Applied {new Date(l.created_at).toLocaleDateString('en-IN')}</small>
                  <button className="leave-btn primary sm" onClick={() => setReviewing(l)}>Review →</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {reviewing && (
        <ReviewModal
          leave={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => { setReviewing(null); load(); }}
        />
      )}
    </div>
  );
}
