'use client';
import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle2, LogOut } from 'lucide-react';

const STATUS_LABELS = {
  PENDING_TL: 'Waiting for TL', PENDING_HR: 'Approved by TL → HR',
  PENDING_ADMIN: 'Approved by HR → Admin', APPROVED: 'Approved', REJECTED: 'Rejected',
};

function StatusBadge({ status }) {
  const MAP = {
    PENDING_TL:    { label: 'Waiting TL',    color: '#f59e0b', bg: '#fef3c7' },
    PENDING_HR:    { label: 'Waiting HR',    color: '#3b82f6', bg: '#dbeafe' },
    PENDING_ADMIN: { label: 'Waiting Admin', color: '#8b5cf6', bg: '#ede9fe' },
    APPROVED:      { label: '✅ Approved',   color: '#10b981', bg: '#d1fae5' },
    REJECTED:      { label: '❌ Rejected',   color: '#ef4444', bg: '#fee2e2' },
  };
  const s = MAP[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{s.label}</span>;
}

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

/* ─── Generic Action Modal (works for Leave, Permission/OD, Attendance) ─── */
function ActionModal({ title, details, apiUrl, onClose, onDone }) {
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!action) { setError('Select Approve or Reject.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed.'); setBusy(false); return; }
      onDone();
    } catch { setError('Network error.'); setBusy(false); }
  }

  return (
    <div className="ess-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ess-modal">
        <div className="ess-modal-header">
          <h2>{title}</h2>
          <button type="button" className="ess-modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px 24px' }}>
          {details.map(d => (
            <div key={d.label} className="ess-detail-row">
              <span>{d.label}</span>
              <span>{d.value}</span>
            </div>
          ))}
          <div className="ess-review-actions" style={{ marginTop: 16 }}>
            <button className={`ess-action-btn approve ${action === 'APPROVE' ? 'selected' : ''}`} onClick={() => setAction('APPROVE')}>✔ Approve</button>
            <button className={`ess-action-btn reject ${action === 'REJECT' ? 'selected' : ''}`} onClick={() => setAction('REJECT')}>✕ Reject</button>
          </div>
          <label className="ess-field" style={{ marginTop: 10 }}>
            <span>Note (optional)</span>
            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className="ess-field textarea" />
          </label>
          {error && <p className="ess-error" style={{ marginTop: 8 }}>{error}</p>}
          <div className="ess-form-actions" style={{ marginTop: 14 }}>
            <button type="button" className="ess-btn secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="ess-btn primary" onClick={submit} disabled={busy || !action}>{busy ? 'Saving…' : 'Submit Review'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Team Attendance Pie Chart ─── */
function TeamPieChart({ records }) {
  const total = records.length;
  const counts = {
    Present:  records.filter(r => r.att_status === 'PRESENT').length,
    'Half Day': records.filter(r => r.att_status === 'HALF_DAY').length,
    Absent:   records.filter(r => r.att_status === 'ABSENT').length,
    'Week Off': records.filter(r => r.att_status === 'WEEK_OFF' || r.week_off).length,
  };
  const colors = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'];
  const data = Object.entries(counts).map(([label, value], i) => ({ label, value, color: colors[i] }));
  const r = 60, cx = 80, cy = 80, circ = 2 * Math.PI * r;
  if (total === 0) return <div className="ess-empty">No attendance data for this month.</div>;
  let offset = 0;
  const slices = data.map(d => {
    const pct = d.value / total;
    const dash = pct * circ;
    const s = { ...d, dash, offset };
    offset += dash;
    return s;
  });
  return (
    <div className="ess-pie-wrap">
      <svg width={160} height={160} viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={28}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-s.offset} />
        ))}
      </svg>
      <div className="ess-pie-legend">
        {data.map(d => (
          <div key={d.label} className="ess-pie-legend-item">
            <span style={{ background: d.color }} />{d.label} ({d.value})
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── TL Dashboard ─── */
export default function TLDashboard({ actor }) {
  const [tab, setTab] = useState('leave');
  const [leaves, setLeaves] = useState([]);
  const [permRecords, setPermRecords] = useState([]);
  const [attRecords, setAttRecords] = useState([]);
  const [musterRecords, setMusterRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { type, item }

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lr, pr, ar, mr] = await Promise.all([
        fetch('/api/leave/pending/tl', { cache: 'no-store' }).then(r => r.ok ? r.json() : { leaves: [] }),
        fetch('/api/leave/permission/pending/tl', { cache: 'no-store' }).then(r => r.ok ? r.json() : { records: [] }),
        fetch('/api/leave/attendance/pending/tl', { cache: 'no-store' }).then(r => r.ok ? r.json() : { records: [] }),
        fetch(`/api/leave/attendance/muster?month=${thisMonth}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : { muster: [] }),
      ]);
      setLeaves(lr.leaves || []);
      setPermRecords(pr.records || []);
      setAttRecords(ar.records || []);
      // Flatten muster for pie chart
      const allDays = (mr.muster || []).flatMap(m => m.days || []);
      setMusterRecords(allDays);
    } finally { setLoading(false); }
  }, [thisMonth]);

  useEffect(() => { load(); }, [load]);

  async function signout() {
    await fetch('/api/leave/session', { method: 'DELETE' });
    window.location.assign('/leave/login');
  }

  function openLeaveModal(item) { setModal({ type: 'leave', item }); }
  function openPermModal(item) { setModal({ type: 'perm', item }); }
  function openAttModal(item) { setModal({ type: 'att', item }); }

  return (
    <div className="ess-shell">
      <header className="ess-topbar">
        <div className="ess-topbar-brand">
          <img src="/codeemy-technologies.png" alt="CodeEmy" height={36} />
        </div>
        <div className="ess-topbar-right">
          <span className="ess-topbar-name">{actor.full_name}</span>
          <span className="ess-topbar-role">Team Leader</span>
          <button className="ess-signout-btn" onClick={signout}>Sign Out</button>
        </div>
      </header>

      <div style={{ padding: '24px 32px', flex: 1 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 20px' }}>Team Approval Dashboard</h1>

        {/* Tabs */}
        <div className="ess-tabs">
          <button className={`ess-tab ${tab === 'leave' ? 'active' : ''}`} onClick={() => setTab('leave')}>
            Leave Requests {leaves.length > 0 && <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{leaves.length}</span>}
          </button>
          <button className={`ess-tab ${tab === 'perm' ? 'active' : ''}`} onClick={() => setTab('perm')}>
            Permission / OD {permRecords.length > 0 && <span style={{ background: '#3b82f6', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{permRecords.length}</span>}
          </button>
          <button className={`ess-tab ${tab === 'att' ? 'active' : ''}`} onClick={() => setTab('att')}>
            Attendance {attRecords.length > 0 && <span style={{ background: '#8b5cf6', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{attRecords.length}</span>}
          </button>
          <button className={`ess-tab ${tab === 'muster' ? 'active' : ''}`} onClick={() => setTab('muster')}>
            Team Muster
          </button>
        </div>

        {loading ? <div className="ess-loading">Loading…</div> : (
          <>
            {/* Leave Tab */}
            {tab === 'leave' && (
              leaves.length === 0 ? (
                <div className="ess-empty"><CheckCircle2 size={40} color="#10b981" /><p>No pending leave requests.</p></div>
              ) : (
                <div className="ess-table-wrap">
                  <table className="ess-table">
                    <thead><tr>
                      <th>Employee</th><th>Leave Type</th><th>Subject</th><th>From</th><th>To</th><th>Applied</th><th>Action</th>
                    </tr></thead>
                    <tbody>
                      {leaves.map(l => (
                        <tr key={l.id}>
                          <td><strong>{l.employee?.full_name}</strong><div style={{ fontSize: 11, color: '#64748b' }}>{l.employee?.department}</div></td>
                          <td><span className="ess-type-chip">{l.leave_type}</span></td>
                          <td>{l.subject}</td>
                          <td>{fmt(l.from_date)}</td>
                          <td>{fmt(l.to_date)}</td>
                          <td>{fmt(l.created_at)}</td>
                          <td><button className="ess-btn primary sm" onClick={() => openLeaveModal(l)}>Review →</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Permission/OD Tab */}
            {tab === 'perm' && (
              permRecords.length === 0 ? (
                <div className="ess-empty"><CheckCircle2 size={40} color="#10b981" /><p>No pending Permission/OD requests.</p></div>
              ) : (
                <div className="ess-table-wrap">
                  <table className="ess-table">
                    <thead><tr>
                      <th>Employee</th><th>Type</th><th>Day Type</th><th>From</th><th>To</th><th>From Time</th><th>To Time</th><th>Reason</th><th>Action</th>
                    </tr></thead>
                    <tbody>
                      {permRecords.map(r => (
                        <tr key={r.id}>
                          <td><strong>{r.employee?.full_name}</strong><div style={{ fontSize: 11, color: '#64748b' }}>{r.employee?.department}</div></td>
                          <td><span className="ess-type-chip od">{r.od_type === 'ON_DUTY' ? 'OD' : 'Perm'}</span></td>
                          <td>{r.day_type}</td>
                          <td>{fmt(r.from_date)}</td>
                          <td>{fmt(r.to_date)}</td>
                          <td>{r.from_time || '—'}</td>
                          <td>{r.to_time || '—'}</td>
                          <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
                          <td><button className="ess-btn primary sm" onClick={() => openPermModal(r)}>Review →</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Attendance Tab */}
            {tab === 'att' && (
              attRecords.length === 0 ? (
                <div className="ess-empty"><CheckCircle2 size={40} color="#10b981" /><p>No pending attendance requests.</p></div>
              ) : (
                <div className="ess-table-wrap">
                  <table className="ess-table">
                    <thead><tr>
                      <th>Employee</th><th>Date</th><th>Shift</th><th>Shift In</th><th>Shift Out</th><th>Req In</th><th>Req Out</th><th>Att Status</th><th>Reason</th><th>Action</th>
                    </tr></thead>
                    <tbody>
                      {attRecords.map(r => (
                        <tr key={r.id}>
                          <td><strong>{r.employee?.full_name}</strong></td>
                          <td>{fmt(r.att_date)}</td>
                          <td>{r.shift}</td>
                          <td>{r.shift_in || '—'}</td>
                          <td>{r.shift_out || '—'}</td>
                          <td>{r.request_in || '—'}</td>
                          <td>{r.request_out || '—'}</td>
                          <td><span className={`ess-att-chip ${r.att_status?.toLowerCase()}`}>{r.att_status}</span></td>
                          <td>{r.reason}</td>
                          <td><button className="ess-btn primary sm" onClick={() => openAttModal(r)}>Review →</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Team Muster Tab */}
            {tab === 'muster' && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>Team Attendance — {thisMonth}</h3>
                <div className="ess-chart-card" style={{ maxWidth: 420, marginBottom: 20 }}>
                  <div className="ess-chart-header"><span>This Month's Attendance Overview</span></div>
                  <TeamPieChart records={musterRecords} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'leave' && (
        <ActionModal
          title={`Review Leave — ${modal.item.employee?.full_name}`}
          apiUrl={`/api/leave/${modal.item.id}/tl-action`}
          details={[
            { label: 'Leave Type', value: modal.item.leave_type },
            { label: 'From', value: fmt(modal.item.from_date) },
            { label: 'To', value: fmt(modal.item.to_date) },
            { label: 'Subject', value: modal.item.subject },
            { label: 'Reason', value: modal.item.reason },
          ]}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
      {modal?.type === 'perm' && (
        <ActionModal
          title={`Review Permission/OD — ${modal.item.employee?.full_name}`}
          apiUrl={`/api/leave/permission/${modal.item.id}/action`}
          details={[
            { label: 'Type', value: modal.item.od_type },
            { label: 'Day Type', value: modal.item.day_type },
            { label: 'From', value: fmt(modal.item.from_date) },
            { label: 'To', value: fmt(modal.item.to_date) },
            { label: 'From Time', value: modal.item.from_time || '—' },
            { label: 'To Time', value: modal.item.to_time || '—' },
            { label: 'Reason', value: modal.item.reason },
          ]}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
      {modal?.type === 'att' && (
        <ActionModal
          title={`Review Attendance — ${modal.item.employee?.full_name}`}
          apiUrl={`/api/leave/attendance/${modal.item.id}/action`}
          details={[
            { label: 'Date', value: fmt(modal.item.att_date) },
            { label: 'Shift', value: modal.item.shift },
            { label: 'Shift In', value: modal.item.shift_in || '—' },
            { label: 'Shift Out', value: modal.item.shift_out || '—' },
            { label: 'Req In', value: modal.item.request_in || '—' },
            { label: 'Req Out', value: modal.item.request_out || '—' },
            { label: 'Att Status', value: modal.item.att_status },
            { label: 'Reason', value: modal.item.reason },
          ]}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
