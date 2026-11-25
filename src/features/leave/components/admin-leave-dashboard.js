'use client';
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, LogOut } from 'lucide-react';
import EmployeesManager from './employees-manager';

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

/* ─── Generic Action Modal ─── */
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
            <div key={d.label} className="ess-detail-row"><span>{d.label}</span><span>{d.value}</span></div>
          ))}
          <div className="ess-review-actions" style={{ marginTop: 16 }}>
            <button className={`ess-action-btn approve ${action === 'APPROVE' ? 'selected' : ''}`} onClick={() => setAction('APPROVE')}>✔ Final Approve</button>
            <button className={`ess-action-btn reject ${action === 'REJECT' ? 'selected' : ''}`} onClick={() => setAction('REJECT')}>✕ Reject</button>
          </div>
          <label className="ess-field" style={{ marginTop: 10 }}>
            <span>Management Note (optional)</span>
            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} />
          </label>
          {error && <p className="ess-error" style={{ marginTop: 8 }}>{error}</p>}
          <div className="ess-form-actions" style={{ marginTop: 14 }}>
            <button type="button" className="ess-btn secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="ess-btn primary" onClick={submit} disabled={busy || !action}>{busy ? 'Saving…' : 'Confirm Decision'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pie Chart ─── */
function AllPieChart({ records }) {
  const total = records.length;
  const counts = {
    Present: records.filter(r => r.att_status === 'PRESENT').length,
    'Half Day': records.filter(r => r.att_status === 'HALF_DAY').length,
    Absent: records.filter(r => r.att_status === 'ABSENT').length,
    'Week Off': records.filter(r => r.att_status === 'WEEK_OFF' || r.week_off).length,
  };
  const colors = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'];
  const data = Object.entries(counts).map(([label, value], i) => ({ label, value, color: colors[i] }));
  if (total === 0) return <div className="ess-empty">No attendance data.</div>;
  const r = 60, cx = 80, cy = 80, circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map(d => { const pct = d.value / total; const dash = pct * circ; const s = { ...d, dash, offset }; offset += dash; return s; });
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
        {data.map(d => <div key={d.label} className="ess-pie-legend-item"><span style={{ background: d.color }} />{d.label} ({d.value})</div>)}
      </div>
    </div>
  );
}

export default function AdminLeaveDashboard({ actor, embedded = false }) {
  const [tab, setTab] = useState('pending');
  const [leaves, setLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [permRecords, setPermRecords] = useState([]);
  const [attRecords, setAttRecords] = useState([]);
  const [musterRecords, setMusterRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, aRes, prRes, arRes, mrRes] = await Promise.all([
        fetch('/api/leave/pending/admin', { cache: 'no-store' }),
        fetch('/api/leave/all', { cache: 'no-store' }),
        fetch('/api/leave/permission/pending/admin', { cache: 'no-store' }),
        fetch('/api/leave/attendance/pending/admin', { cache: 'no-store' }),
        fetch(`/api/leave/attendance/muster?month=${thisMonth}`, { cache: 'no-store' }),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setLeaves(d.leaves || []); }
      if (aRes.ok) { const d = await aRes.json(); setAllLeaves(d.leaves || []); }
      if (prRes.ok) { const d = await prRes.json(); setPermRecords(d.records || []); }
      if (arRes.ok) { const d = await arRes.json(); setAttRecords(d.records || []); }
      if (mrRes.ok) { const d = await mrRes.json(); setMusterRecords((d.muster || []).flatMap(m => m.days || [])); }
    } finally { setLoading(false); }
  }, [thisMonth]);

  useEffect(() => { load(); }, [load]);

  async function signout() {
    await fetch('/api/leave/session', { method: 'DELETE' });
    window.location.assign('/leave/login');
  }

  const totalPending = leaves.length + permRecords.length + attRecords.length;

  const content = (
    <div style={{ padding: embedded ? 0 : '24px 32px', flex: 1 }}>
      <div className="leave-page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>
            {embedded ? 'Leave Management & Approvals' : 'Final Approval Dashboard'}
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Approve HR-verified requests, review history, and manage employees.</p>
        </div>
        {totalPending > 0 && (
          <span style={{ background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 14, padding: '6px 16px', borderRadius: 20 }}>{totalPending} Awaiting</span>
        )}
      </div>

      <div className="ess-tabs">
        <button className={`ess-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending Leave {leaves.length > 0 && <span style={{ background: '#7c3aed', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{leaves.length}</span>}
        </button>
        <button className={`ess-tab ${tab === 'perm' ? 'active' : ''}`} onClick={() => setTab('perm')}>
          Pending Perm/OD {permRecords.length > 0 && <span style={{ background: '#3b82f6', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{permRecords.length}</span>}
        </button>
        <button className={`ess-tab ${tab === 'att' ? 'active' : ''}`} onClick={() => setTab('att')}>
          Pending Attendance {attRecords.length > 0 && <span style={{ background: '#8b5cf6', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>{attRecords.length}</span>}
        </button>
        <button className={`ess-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All Leave</button>
        <button className={`ess-tab ${tab === 'muster' ? 'active' : ''}`} onClick={() => setTab('muster')}>Attendance Overview</button>
        <button className={`ess-tab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>Employees &amp; Teams</button>
      </div>

      {loading && tab !== 'employees' ? <div className="ess-loading">Loading…</div> : (
        <>
          {/* Pending Leave */}
          {tab === 'pending' && (
            leaves.length === 0 ? (
              <div className="ess-empty"><CheckCircle2 size={40} color="#10b981" /><p>No leaves pending final approval.</p></div>
            ) : (
              <div className="ess-table-wrap">
                <table className="ess-table">
                  <thead><tr>
                    <th>Employee</th><th>Type</th><th>Subject</th><th>Dates</th><th>TL ✅</th><th>HR ✅</th><th>Action</th>
                  </tr></thead>
                  <tbody>
                    {leaves.map(l => (
                      <tr key={l.id}>
                        <td><strong>{l.employee?.full_name}</strong><div style={{ fontSize: 11, color: '#64748b' }}>{l.employee?.department}</div></td>
                        <td><span className="ess-type-chip">{l.leave_type}</span></td>
                        <td>{l.subject}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmt(l.from_date)} → {fmt(l.to_date)}</td>
                        <td><span className="ess-approved-tick">✅ {l.tl_reviewer?.full_name || ''}</span></td>
                        <td><span className="ess-approved-tick">✅ {l.hr_reviewer?.full_name || ''}</span></td>
                        <td><button className="ess-btn primary sm" onClick={() => setModal({ type: 'leave', item: l })}>Decide →</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Pending Permission/OD */}
          {tab === 'perm' && (
            permRecords.length === 0 ? (
              <div className="ess-empty"><CheckCircle2 size={40} color="#10b981" /><p>No Permission/OD pending final approval.</p></div>
            ) : (
              <div className="ess-table-wrap">
                <table className="ess-table">
                  <thead><tr>
                    <th>Employee</th><th>Type</th><th>Day Type</th><th>From</th><th>To</th><th>Time</th><th>Reason</th><th>TL ✅</th><th>HR ✅</th><th>Action</th>
                  </tr></thead>
                  <tbody>
                    {permRecords.map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.employee?.full_name}</strong></td>
                        <td><span className="ess-type-chip od">{r.od_type === 'ON_DUTY' ? 'OD' : 'Perm'}</span></td>
                        <td>{r.day_type}</td>
                        <td>{fmt(r.from_date)}</td>
                        <td>{fmt(r.to_date)}</td>
                        <td>{r.from_time || '—'} — {r.to_time || '—'}</td>
                        <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
                        <td>{r.tl_action === 'APPROVE' ? <span className="ess-approved-tick">✅</span> : '—'}</td>
                        <td>{r.hr_action === 'APPROVE' ? <span className="ess-approved-tick">✅</span> : '—'}</td>
                        <td><button className="ess-btn primary sm" onClick={() => setModal({ type: 'perm', item: r })}>Decide →</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Pending Attendance */}
          {tab === 'att' && (
            attRecords.length === 0 ? (
              <div className="ess-empty"><CheckCircle2 size={40} color="#10b981" /><p>No attendance pending final approval.</p></div>
            ) : (
              <div className="ess-table-wrap">
                <table className="ess-table">
                  <thead><tr>
                    <th>Employee</th><th>Date</th><th>Shift</th><th>In</th><th>Out</th><th>Att Status</th><th>Reason</th><th>TL ✅</th><th>HR ✅</th><th>Action</th>
                  </tr></thead>
                  <tbody>
                    {attRecords.map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.employee?.full_name}</strong></td>
                        <td>{fmt(r.att_date)}</td>
                        <td>{r.shift}</td>
                        <td>{r.shift_in || '—'}</td>
                        <td>{r.shift_out || '—'}</td>
                        <td><span className={`ess-att-chip ${r.att_status?.toLowerCase()}`}>{r.att_status}</span></td>
                        <td>{r.reason}</td>
                        <td>{r.tl_action === 'APPROVE' ? <span className="ess-approved-tick">✅</span> : '—'}</td>
                        <td>{r.hr_action === 'APPROVE' ? <span className="ess-approved-tick">✅</span> : '—'}</td>
                        <td><button className="ess-btn primary sm" onClick={() => setModal({ type: 'att', item: r })}>Decide →</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* All Leave Requests */}
          {tab === 'all' && (
            allLeaves.length === 0 ? (
              <div className="ess-empty"><p>No leave applications.</p></div>
            ) : (
              <div className="ess-table-wrap">
                <table className="ess-table">
                  <thead><tr><th>Employee</th><th>Type</th><th>Subject</th><th>Dates</th><th>Status</th><th>Doc</th></tr></thead>
                  <tbody>
                    {allLeaves.map(l => (
                      <tr key={l.id}>
                        <td><strong>{l.employee?.full_name}</strong><div style={{ fontSize: 11, color: '#64748b' }}>{l.employee?.department}</div></td>
                        <td><span className="ess-type-chip">{l.leave_type}</span></td>
                        <td>{l.subject}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmt(l.from_date)} → {fmt(l.to_date)}</td>
                        <td><StatusBadge status={l.status} /></td>
                        <td>{l.document_url ? <a href={l.document_url} target="_blank" rel="noreferrer">📎</a> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Attendance Overview Pie */}
          {tab === 'muster' && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>All Employees Attendance — {thisMonth}</h3>
              <div className="ess-chart-card" style={{ maxWidth: 420 }}>
                <div className="ess-chart-header"><span>Monthly Attendance Overview</span></div>
                <AllPieChart records={musterRecords} />
              </div>
            </div>
          )}

          {/* Employees & Teams */}
          {tab === 'employees' && <EmployeesManager />}
        </>
      )}

      {/* Modals */}
      {modal?.type === 'leave' && (
        <ActionModal
          title={`Final Approval — ${modal.item.employee?.full_name}`}
          apiUrl={`/api/leave/${modal.item.id}/admin-action`}
          details={[
            { label: 'Leave Type', value: modal.item.leave_type },
            { label: 'From', value: fmt(modal.item.from_date) },
            { label: 'To', value: fmt(modal.item.to_date) },
            { label: 'Subject', value: modal.item.subject },
            { label: 'Reason', value: modal.item.reason },
            { label: 'TL', value: `✅ ${modal.item.tl_reviewer?.full_name || 'Approved'}` },
            { label: 'HR', value: `✅ ${modal.item.hr_reviewer?.full_name || 'Approved'}` },
          ]}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
      {modal?.type === 'perm' && (
        <ActionModal
          title={`Final Approval Permission/OD — ${modal.item.employee?.full_name}`}
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
          title={`Final Approval Attendance — ${modal.item.employee?.full_name}`}
          apiUrl={`/api/leave/attendance/${modal.item.id}/action`}
          details={[
            { label: 'Date', value: fmt(modal.item.att_date) },
            { label: 'Shift', value: modal.item.shift },
            { label: 'In / Out', value: `${modal.item.shift_in || '—'} → ${modal.item.shift_out || '—'}` },
            { label: 'Att Status', value: modal.item.att_status },
            { label: 'Reason', value: modal.item.reason },
          ]}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="ess-shell">
      <header className="ess-topbar">
        <div className="ess-topbar-brand">
          <img src="/codeemy-technologies.png" alt="CodeEmy" height={36} />
        </div>
        <div className="ess-topbar-right">
          <span className="ess-topbar-name">{actor?.full_name}</span>
          <span className="ess-topbar-role" style={{ background: 'rgba(124,58,237,.3)', color: '#fff' }}>Admin / Mgmt</span>
          <button className="ess-signout-btn" onClick={signout}>Sign Out</button>
        </div>
      </header>
      {content}
    </div>
  );
}
