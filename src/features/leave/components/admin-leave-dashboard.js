'use client';
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, LogOut } from 'lucide-react';
import EmployeesManager from './employees-manager';

const STATUS_LABELS = {
  PENDING_TL: { label: 'Waiting for TL', color: '#f59e0b', bg: '#fef3c7' },
  PENDING_HR: { label: 'Waiting for HR', color: '#3b82f6', bg: '#dbeafe' },
  PENDING_ADMIN: { label: 'Waiting for Admin', color: '#8b5cf6', bg: '#ede9fe' },
  APPROVED: { label: 'Approved', color: '#10b981', bg: '#d1fae5' },
  REJECTED: { label: 'Rejected', color: '#ef4444', bg: '#fee2e2' },
};

function AdminReviewModal({ leave, onClose, onDone }) {
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!action) { setError('Select Approve or Reject.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/leave/${leave.id}/admin-action`, {
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
          <h2>Final Approval — {leave.employee?.full_name}</h2>
          <button type="button" className="leave-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="leave-detail">
          <div className="leave-detail-row"><span>Type</span><span className="leave-type-chip">{leave.leave_type}</span></div>
          <div className="leave-detail-row"><span>Dates</span><span>{new Date(leave.from_date).toLocaleDateString('en-IN')} → {new Date(leave.to_date).toLocaleDateString('en-IN')}</span></div>
          <div className="leave-detail-row"><span>Subject</span><strong>{leave.subject}</strong></div>
          <p className="leave-reason-text">{leave.reason}</p>
          {leave.document_url && <a href={leave.document_url} target="_blank" rel="noreferrer" className="leave-doc-link">📎 View Medical / Supporting Document</a>}
          <div className="leave-approval-chain">
            <div className="leave-chain-step done"><span>✓ TL</span>{leave.tl_reviewer && <small>{leave.tl_reviewer.full_name}</small>}{leave.tl_note && <em>&ldquo;{leave.tl_note}&rdquo;</em>}</div>
            <div className="leave-chain-step done"><span>✓ HR</span>{leave.hr_reviewer && <small>{leave.hr_reviewer.full_name}</small>}{leave.hr_note && <em>&ldquo;{leave.hr_note}&rdquo;</em>}</div>
          </div>
          <div className="leave-review-actions">
            <button className={`leave-action-btn approve ${action === 'APPROVE' ? 'selected' : ''}`} onClick={() => setAction('APPROVE')}>✓ Final Approve</button>
            <button className={`leave-action-btn reject ${action === 'REJECT' ? 'selected' : ''}`} onClick={() => setAction('REJECT')}>✗ Reject</button>
          </div>
          <label className="leave-field">
            <span>Management Note (optional)</span>
            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} />
          </label>
          {error && <p className="leave-error" role="alert">{error}</p>}
          <div className="leave-form-actions">
            <button type="button" className="leave-btn secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="leave-btn primary" onClick={submit} disabled={busy || !action}>{busy ? 'Saving…' : 'Confirm Decision'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLeaveDashboard({ actor, embedded = false }) {
  const [tab, setTab] = useState('pending');
  const [leaves, setLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        fetch('/api/leave/pending/admin', { cache: 'no-store' }),
        fetch('/api/leave/all', { cache: 'no-store' }),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setLeaves(d.leaves || []); }
      if (aRes.ok) { const d = await aRes.json(); setAllLeaves(d.leaves || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function signout() {
    await fetch('/api/leave/session', { method: 'DELETE' });
    window.location.assign('/leave/login');
  }

  const content = (
    <main className={embedded ? '' : 'leave-main'}>
      <div className="leave-page-header">
        <div>
          <h1>{embedded ? 'Leave Management & Approvals' : 'Final Leave Approval'}</h1>
          <p>Approve HR-verified leave requests, review history, and manage employee roles.</p>
        </div>
        <div className="leave-count-badge admin">{leaves.length} Awaiting</div>
      </div>

      <div className="leave-tabs">
        <button className={`leave-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending Final Approval ({leaves.length})
        </button>
        <button className={`leave-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All Leave Requests ({allLeaves.length})
        </button>
        <button className={`leave-tab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>
          Employees &amp; Teams
        </button>
      </div>

      {tab === 'employees' ? (
        <EmployeesManager />
      ) : tab === 'all' ? (
        allLeaves.length === 0 ? (
          <div className="leave-empty"><p>No leave applications yet.</p></div>
        ) : (
          <div className="leave-table-wrap">
            <table className="leave-table">
              <thead>
                <tr><th>Employee</th><th>Type</th><th>Subject</th><th>Dates</th><th>Status</th><th>Document</th></tr>
              </thead>
              <tbody>
                {allLeaves.map(l => {
                  const s = STATUS_LABELS[l.status] || { label: l.status, color: '#6b7280', bg: '#f3f4f6' };
                  return (
                    <tr key={l.id}>
                      <td><strong>{l.employee?.full_name}</strong><br /><small style={{ color: '#6b7280' }}>{l.employee?.department || l.employee?.email}</small></td>
                      <td><span className="leave-type-chip">{l.leave_type}</span></td>
                      <td>{l.subject}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.from_date).toLocaleDateString('en-IN')} → {new Date(l.to_date).toLocaleDateString('en-IN')}</td>
                      <td><span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{s.label}</span></td>
                      <td>{l.document_url ? <a href={l.document_url} target="_blank" rel="noreferrer" className="leave-doc-link">📎 View</a> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : loading ? (
        <div className="leave-loading">Loading…</div>
      ) : leaves.length === 0 ? (
        <div className="leave-empty">
          <CheckCircle2 size={48} color="#10b981" />
          <p>No leaves pending your approval.</p>
        </div>
      ) : (
        <div className="leave-table-wrap">
          <table className="leave-table">
            <thead>
              <tr><th>Employee</th><th>Type</th><th>Subject</th><th>Dates</th><th>TL ✓</th><th>HR ✓</th><th></th></tr>
            </thead>
            <tbody>
              {leaves.map(l => (
                <tr key={l.id}>
                  <td><strong>{l.employee?.full_name}</strong><br /><small style={{ color: '#6b7280' }}>{l.employee?.department || l.employee?.email}</small></td>
                  <td><span className="leave-type-chip">{l.leave_type}</span></td>
                  <td>{l.subject}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.from_date).toLocaleDateString('en-IN')} → {new Date(l.to_date).toLocaleDateString('en-IN')}</td>
                  <td style={{ color: '#10b981' }}>✓ {l.tl_reviewer?.full_name || ''}</td>
                  <td style={{ color: '#10b981' }}>✓ {l.hr_reviewer?.full_name || ''}</td>
                  <td><button className="leave-btn primary sm" onClick={() => setReviewing(l)}>Decide →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && <AdminReviewModal leave={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); load(); }} />}
    </main>
  );

  if (embedded) return content;

  return (
    <div className="leave-shell">
      <header className="leave-topbar">
        <div className="leave-topbar-brand">
          <img src="/codeemy-technologies.png" alt="CodeEmy" width={120} />
          <span className="leave-role-chip admin">Admin / Mgmt</span>
        </div>
        <div className="leave-topbar-right">
          <span className="leave-user-name">👤 {actor?.full_name}</span>
          <button className="leave-signout-btn" onClick={signout}><LogOut size={15} /> Sign out</button>
        </div>
      </header>
      {content}
    </div>
  );
}
