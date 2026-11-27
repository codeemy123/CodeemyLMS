'use client';
import { useState, useEffect, useCallback } from 'react';
import { LEAVE_ROLE_LABELS as ROLE_LABELS } from '@/lib/leave-roles';

/* ─── Status helpers ─── */
const STATUS_LABELS = {
  PENDING_TL:    { label: 'Waiting TL',    color: '#f59e0b', bg: '#fef3c7' },
  PENDING_HR:    { label: 'Waiting HR',    color: '#3b82f6', bg: '#dbeafe' },
  PENDING_ADMIN: { label: 'Waiting Admin', color: '#8b5cf6', bg: '#ede9fe' },
  APPROVED:      { label: 'Approved',      color: '#10b981', bg: '#d1fae5' },
  REJECTED:      { label: 'Rejected',      color: '#ef4444', bg: '#fee2e2' },
};
function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{s.label}</span>;
}
function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }
function fmtDT(d) { return d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }

/* ─── Pie Chart (SVG, no external deps) ─── */
function PieChart({ data }) {
  // data: [{ label, value, color }]
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="ess-pie-wrap">
        <svg width={160} height={160} viewBox="0 0 160 160">
          <circle cx={80} cy={80} r={60} fill="none" stroke="#e2e8f0" strokeWidth={28} />
        </svg>
        <div className="ess-pie-legend">
          {data.map(d => <div key={d.label} className="ess-pie-legend-item"><span style={{ background: d.color }} />{d.label} (0)</div>)}
        </div>
      </div>
    );
  }
  const r = 60, cx = 80, cy = 80, circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map(d => {
    const pct = d.value / total;
    const dash = pct * circ;
    const slice = { ...d, dash, offset };
    offset += dash;
    return slice;
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

/* ─── Apply Leave Form ─── */
const LEAVE_TYPES = ['SICK', 'CASUAL', 'EMERGENCY', 'OTHER'];
function ApplyLeaveForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({ leaveType: 'SICK', fromDate: '', toDate: '', subject: '', reason: '', documentUrl: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const res = await fetch('/api/leave/upload', {
        method: 'POST',
        headers: { 'x-file-name': encodeURIComponent(file.name), 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed.'); return; }
      setForm(f => ({ ...f, documentUrl: data.url }));
      setUploadedName(file.name);
    } catch { setError('Upload failed.'); } finally { setUploading(false); }
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/api/leave/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed.'); setBusy(false); return; }
      onSuccess();
    } catch { setError('Network error.'); setBusy(false); }
  }

  return (
    <div className="ess-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ess-modal">
        <div className="ess-modal-header"><h2>Apply Leave</h2><button type="button" onClick={onClose} className="ess-modal-close">✕</button></div>
        <form onSubmit={submit} className="ess-form">
          <div className="ess-form-row">
            <label className="ess-field"><span>Leave Type</span>
              <select value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))} required>
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()} Leave</option>)}
              </select>
            </label>
          </div>
          <div className="ess-form-row two-col">
            <label className="ess-field"><span>From Date</span>
              <input type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} required />
            </label>
            <label className="ess-field"><span>To Date</span>
              <input type="date" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} required />
            </label>
          </div>
          <label className="ess-field"><span>Subject</span>
            <input type="text" placeholder="Brief reason" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required maxLength={255} />
          </label>
          <label className="ess-field"><span>Detailed Reason</span>
            <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required />
          </label>
          <label className="ess-field"><span>Supporting Document <small>(optional)</small></span>
            <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={uploading} />
            {uploading && <small style={{ color: '#4f46e5' }}>Uploading…</small>}
            {uploadedName && !uploading && <small style={{ color: '#10b981' }}>✔ {uploadedName}</small>}
          </label>
          {error && <p className="ess-error">{error}</p>}
          <div className="ess-form-actions">
            <button type="button" className="ess-btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="ess-btn primary" disabled={busy || uploading}>{busy ? 'Submitting…' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Apply Permission/OD Form ─── */
function ApplyPermissionForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    od_type: 'PERMISSION', day_type: 'HOURLY', session_type: '',
    from_date: '', to_date: '', from_time: '', to_time: '',
    from_location: '', to_location: '', reason: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/api/leave/permission/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed.'); setBusy(false); return; }
      onSuccess();
    } catch { setError('Network error.'); setBusy(false); }
  }

  return (
    <div className="ess-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ess-modal">
        <div className="ess-modal-header"><h2>Apply Permission / OD</h2><button type="button" onClick={onClose} className="ess-modal-close">✕</button></div>
        <form onSubmit={submit} className="ess-form">
          <div className="ess-form-row two-col">
            <label className="ess-field"><span>Select Type</span>
              <select value={form.od_type} onChange={e => setForm(f => ({ ...f, od_type: e.target.value }))} required>
                <option value="PERMISSION">Permission</option>
                <option value="ON_DUTY">On Duty (OD)</option>
              </select>
            </label>
            <label className="ess-field"><span>Day Type</span>
              <select value={form.day_type} onChange={e => setForm(f => ({ ...f, day_type: e.target.value }))}>
                <option value="HOURLY">Hourly</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="FULL_DAY">Full Day</option>
              </select>
            </label>
          </div>
          {form.day_type !== 'HOURLY' && (
            <label className="ess-field"><span>Session Type</span>
              <select value={form.session_type} onChange={e => setForm(f => ({ ...f, session_type: e.target.value }))}>
                <option value="">Select Session</option>
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
                <option value="FULL_DAY">Full Day</option>
              </select>
            </label>
          )}
          <div className="ess-form-row two-col">
            <label className="ess-field"><span>From Date</span>
              <input type="date" value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} required />
            </label>
            <label className="ess-field"><span>To Date</span>
              <input type="date" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} required />
            </label>
          </div>
          {form.day_type === 'HOURLY' && (
            <div className="ess-form-row two-col">
              <label className="ess-field"><span>From Time</span>
                <input type="time" value={form.from_time} onChange={e => setForm(f => ({ ...f, from_time: e.target.value }))} />
              </label>
              <label className="ess-field"><span>To Time</span>
                <input type="time" value={form.to_time} onChange={e => setForm(f => ({ ...f, to_time: e.target.value }))} />
              </label>
            </div>
          )}
          {form.od_type === 'ON_DUTY' && (
            <div className="ess-form-row two-col">
              <label className="ess-field"><span>From Location</span>
                <input type="text" placeholder="Office / Client site" value={form.from_location} onChange={e => setForm(f => ({ ...f, from_location: e.target.value }))} />
              </label>
              <label className="ess-field"><span>To Location</span>
                <input type="text" placeholder="Destination" value={form.to_location} onChange={e => setForm(f => ({ ...f, to_location: e.target.value }))} />
              </label>
            </div>
          )}
          <label className="ess-field"><span>Reason</span>
            <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required />
          </label>
          {error && <p className="ess-error">{error}</p>}
          <div className="ess-form-actions">
            <button type="button" className="ess-btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="ess-btn primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Apply Attendance Form ─── */
function ApplyAttendanceForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    att_date: '', week_off: false, shift: 'GENERAL',
    shift_in: '', shift_out: '', request_in: '', request_out: '',
    att_status: 'PRESENT', reason: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/api/leave/attendance/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed.'); setBusy(false); return; }
      onSuccess();
    } catch { setError('Network error.'); setBusy(false); }
  }

  return (
    <div className="ess-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ess-modal">
        <div className="ess-modal-header"><h2>Apply Daily Attendance</h2><button type="button" onClick={onClose} className="ess-modal-close">✕</button></div>
        <form onSubmit={submit} className="ess-form">
          <div className="ess-form-row two-col">
            <label className="ess-field"><span>Date</span>
              <input type="date" value={form.att_date} onChange={e => setForm(f => ({ ...f, att_date: e.target.value }))} required />
            </label>
            <label className="ess-field"><span>Week Off</span>
              <select value={form.week_off ? 'Yes' : 'No'} onChange={e => setForm(f => ({ ...f, week_off: e.target.value === 'Yes' }))}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </label>
          </div>
          <div className="ess-form-row two-col">
            <label className="ess-field"><span>Shift</span>
              <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}>
                <option value="GENERAL">General</option>
                <option value="MORNING">Morning</option>
                <option value="EVENING">Evening</option>
                <option value="NIGHT">Night</option>
              </select>
            </label>
            <label className="ess-field"><span>Attendance Status</span>
              <select value={form.att_status} onChange={e => setForm(f => ({ ...f, att_status: e.target.value }))}>
                <option value="PRESENT">Present</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ABSENT">Absent</option>
                <option value="WEEK_OFF">Week Off</option>
              </select>
            </label>
          </div>
          <div className="ess-form-row two-col">
            <label className="ess-field"><span>Shift In Time</span>
              <input type="time" value={form.shift_in} onChange={e => setForm(f => ({ ...f, shift_in: e.target.value }))} />
            </label>
            <label className="ess-field"><span>Shift Out Time</span>
              <input type="time" value={form.shift_out} onChange={e => setForm(f => ({ ...f, shift_out: e.target.value }))} />
            </label>
          </div>
          <div className="ess-form-row two-col">
            <label className="ess-field"><span>Request Time In</span>
              <input type="time" value={form.request_in} onChange={e => setForm(f => ({ ...f, request_in: e.target.value }))} />
            </label>
            <label className="ess-field"><span>Request Time Out</span>
              <input type="time" value={form.request_out} onChange={e => setForm(f => ({ ...f, request_out: e.target.value }))} />
            </label>
          </div>
          <label className="ess-field"><span>Reason</span>
            <textarea rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required />
          </label>
          {error && <p className="ess-error">{error}</p>}
          <div className="ess-form-actions">
            <button type="button" className="ess-btn secondary" onClick={onClose}>Clear</button>
            <button type="submit" className="ess-btn primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Leave Status Table ─── */
function LeaveStatusTable({ leaves }) {
  if (!leaves.length) return <div className="ess-empty">No leave applications yet.</div>;
  return (
    <div className="ess-table-wrap">
      <table className="ess-table">
        <thead><tr>
          <th>Applied Date</th><th>Leave Type</th><th>Leave From</th><th>Leave To</th>
          <th>Subject</th><th>Status</th><th>Approved By</th><th>Approval Date</th>
        </tr></thead>
        <tbody>
          {leaves.map(l => (
            <tr key={l.id}>
              <td>{fmt(l.created_at)}</td>
              <td><span className="ess-type-chip">{l.leave_type}</span></td>
              <td>{fmt(l.from_date)}</td>
              <td>{fmt(l.to_date)}</td>
              <td>{l.subject}</td>
              <td><StatusBadge status={l.status} /></td>
              <td>
                {l.status === 'APPROVED' && l.admin_reviewed_by ? '✅ Admin' :
                 l.status === 'REJECTED' ? '❌' : '—'}
              </td>
              <td>{l.admin_reviewed_at ? fmt(l.admin_reviewed_at) : l.hr_reviewed_at ? fmt(l.hr_reviewed_at) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Permission/OD Status Table ─── */
function PermissionStatusTable({ records }) {
  if (!records.length) return <div className="ess-empty">No Permission/OD requests yet.</div>;
  return (
    <div className="ess-table-wrap">
      <table className="ess-table">
        <thead><tr>
          <th>Applied Date</th><th>OD Type</th><th>Day Type</th><th>Session</th>
          <th>From Date</th><th>To Date</th><th>From Time</th><th>To Time</th>
          <th>Reason</th><th>Status</th><th>App/Rej By</th><th>Approval Date</th>
        </tr></thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id}>
              <td>{fmt(r.created_at)}</td>
              <td><span className="ess-type-chip od">{r.od_type === 'ON_DUTY' ? 'OD' : 'Permission'}</span></td>
              <td>{r.day_type}</td>
              <td>{r.session_type || '—'}</td>
              <td>{fmt(r.from_date)}</td>
              <td>{fmt(r.to_date)}</td>
              <td>{r.from_time || '—'}</td>
              <td>{r.to_time || '—'}</td>
              <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
              <td><StatusBadge status={r.status} /></td>
              <td>
                {r.status === 'APPROVED' ? '✅' : r.status === 'REJECTED' ? '❌' : '—'}
              </td>
              <td>{r.admin_reviewed_at ? fmt(r.admin_reviewed_at) : r.hr_reviewed_at ? fmt(r.hr_reviewed_at) : r.tl_reviewed_at ? fmt(r.tl_reviewed_at) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Attendance Status Table ─── */
function AttendanceStatusTable({ records }) {
  if (!records.length) return <div className="ess-empty">No attendance records yet.</div>;
  return (
    <div className="ess-table-wrap">
      <table className="ess-table">
        <thead><tr>
          <th>Date</th><th>Shift</th><th>Shift In</th><th>Shift Out</th>
          <th>Req In</th><th>Req Out</th><th>Att Status</th><th>Status</th><th>Reason</th>
        </tr></thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id}>
              <td>{fmt(r.att_date)}</td>
              <td>{r.shift}</td>
              <td>{r.shift_in || '—'}</td>
              <td>{r.shift_out || '—'}</td>
              <td>{r.request_in || '—'}</td>
              <td>{r.request_out || '—'}</td>
              <td>
                <span className={`ess-att-chip ${r.att_status?.toLowerCase()}`}>{r.att_status}</span>
              </td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Employee Muster (Monthly Calendar) ─── */
function EmployeeMuster({ actorId }) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/leave/attendance/muster?month=${month}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        const mine = d.muster?.find(m => m.employee?.id === actorId);
        setRecords(mine?.days || []);
      }
    } finally { setLoading(false); }
  }, [month, actorId]);

  useEffect(() => { load(); }, [load]);

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDay = new Date(y, m - 1, 1).getDay();

  const dayMap = {};
  for (const r of records) {
    const d = new Date(r.att_date);
    dayMap[d.getDate()] = r;
  }

  const ATT_COLORS = { PRESENT: '#10b981', HALF_DAY: '#f59e0b', ABSENT: '#ef4444', WEEK_OFF: '#94a3b8' };
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <div className="ess-muster-controls">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="ess-month-input" />
        <button className="ess-btn secondary sm" onClick={load}>Refresh</button>
      </div>
      {loading ? <div className="ess-loading">Loading muster…</div> : (
        <div className="ess-muster-grid">
          {DAYS.map(d => <div key={d} className="ess-muster-day-header">{d}</div>)}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const rec = dayMap[day];
            const color = rec ? (ATT_COLORS[rec.att_status] || '#e2e8f0') : '#f8fafc';
            return (
              <div key={day} className="ess-muster-cell" style={{ background: color, color: rec ? '#fff' : '#94a3b8' }}>
                <span className="ess-muster-num">{day}</span>
                {rec && <span className="ess-muster-status">{rec.att_status?.slice(0, 3)}</span>}
              </div>
            );
          })}
        </div>
      )}
      <div className="ess-muster-legend">
        {Object.entries(ATT_COLORS).map(([k, v]) => (
          <span key={k} className="ess-muster-legend-item"><span style={{ background: v }} />{k.replace('_', ' ')}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── Leave Balance Card ─── */
const BALANCE_COLORS = { CASUAL: '#6366f1', SICK: '#10b981', EMERGENCY: '#f59e0b', OTHER: '#8b5cf6' };
function LeaveBalanceCard({ balance }) {
  if (!balance) return null;
  const types = ['CASUAL', 'SICK', 'EMERGENCY', 'OTHER'];
  return (
    <div className="ess-balance-card">
      <div className="ess-balance-header">
        <span>🗓 Annual Leave Balance ({balance.year})</span>
        <span className="ess-balance-total">
          Total Remaining: <strong>{balance.remaining.total}</strong> / {balance.allowance.total} days
        </span>
      </div>
      <div className="ess-balance-grid">
        {types.map(t => (
          <div key={t} className="ess-balance-item" style={{ borderTop: `3px solid ${BALANCE_COLORS[t]}` }}>
            <div className="ess-balance-type">{t.charAt(0) + t.slice(1).toLowerCase()} Leave</div>
            <div className="ess-balance-nums">
              <span className="ess-balance-remaining" style={{ color: BALANCE_COLORS[t] }}>{balance.remaining[t]}</span>
              <span className="ess-balance-sep">/</span>
              <span className="ess-balance-allow">{balance.allowance[t]}</span>
            </div>
            <div className="ess-balance-used">Used: {balance.used[t]} day{balance.used[t] !== 1 ? 's' : ''}</div>
            <div className="ess-balance-bar">
              <div className="ess-balance-bar-fill" style={{ width: `${Math.min(100, (balance.used[t] / balance.allowance[t]) * 100)}%`, background: BALANCE_COLORS[t] }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Dashboard Stats + Pie Chart ─── */
function DashboardHome({ actor, leaves, balance, permRecords, attRecords, loading }) {
  const [pieMode, setPieMode] = useState('monthly'); // monthly | today

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = now.toISOString().slice(0, 10);

  const monthAtt = attRecords.filter(r => {
    const d = new Date(r.att_date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === thisMonth && r.status === 'APPROVED';
  });

  const todayAtt = attRecords.filter(r => {
    const d = new Date(r.att_date);
    return d.toISOString().slice(0, 10) === today;
  });

  const pieSource = pieMode === 'monthly' ? monthAtt : todayAtt;
  const pieData = [
    { label: 'Present',  value: pieSource.filter(r => r.att_status === 'PRESENT').length,  color: '#10b981' },
    { label: 'Half Day', value: pieSource.filter(r => r.att_status === 'HALF_DAY').length, color: '#f59e0b' },
    { label: 'Absent',   value: pieSource.filter(r => r.att_status === 'ABSENT').length,   color: '#ef4444' },
    { label: 'Week Off', value: pieSource.filter(r => r.att_status === 'WEEK_OFF' || r.week_off).length, color: '#94a3b8' },
  ];

  const leaveDays = leaves.filter(l => l.status === 'APPROVED').reduce((s, l) => {
    const from = new Date(l.from_date), to = new Date(l.to_date);
    return s + Math.ceil((to - from) / 86400000) + 1;
  }, 0);

  const withPerm = permRecords.filter(r => r.status === 'APPROVED' && r.od_type === 'PERMISSION').length;
  const withOD   = permRecords.filter(r => r.status === 'APPROVED' && r.od_type === 'ON_DUTY').length;
  const presentDays = attRecords.filter(r => r.status === 'APPROVED' && r.att_status === 'PRESENT').length;

  return (
    <div>
      <h2 className="ess-section-title">Dashboard</h2>
      {loading ? <div className="ess-loading">Loading…</div> : (
        <>
          <LeaveBalanceCard balance={balance} />
          <div className="ess-stat-grid">
            {[
              { label: 'Leave Days (Approved)', value: leaveDays, color: '#6366f1' },
              { label: 'With Permission', value: withPerm, color: '#3b82f6' },
              { label: 'On Duty (OD)', value: withOD, color: '#8b5cf6' },
              { label: 'Present Days', value: presentDays, color: '#10b981' },
            ].map(s => (
              <div key={s.label} className="ess-stat-card">
                <div className="ess-stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="ess-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="ess-dashboard-row">
            <div className="ess-chart-card">
              <div className="ess-chart-header">
                <span>Attendance Overview</span>
                <div className="ess-toggle-group">
                  <button className={`ess-toggle-btn ${pieMode === 'monthly' ? 'active' : ''}`} onClick={() => setPieMode('monthly')}>Monthly</button>
                  <button className={`ess-toggle-btn ${pieMode === 'today' ? 'active' : ''}`} onClick={() => setPieMode('today')}>Today</button>
                </div>
              </div>
              <PieChart data={pieData} />
            </div>

            <div className="ess-recent-card">
              <div className="ess-chart-header"><span>Recent Leave Applications</span></div>
              {leaves.slice(0, 5).map(l => (
                <div key={l.id} className="ess-recent-item">
                  <div>
                    <strong>{l.subject}</strong>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{l.leave_type} · {fmt(l.from_date)} → {fmt(l.to_date)}</div>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
              ))}
              {leaves.length === 0 && <div className="ess-empty" style={{ padding: '12px 0' }}>No applications yet.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Sidebar Nav ─── */
const NAV = [
  { id: 'dashboard', icon: '⊞', label: 'DASHBOARD', type: 'link' },
  {
    id: 'request', icon: '📋', label: 'REQUEST', type: 'group',
    children: [
      { id: 'req-leave', label: 'Leave', icon: '📄', action: 'apply-leave' },
      { id: 'req-perm', label: 'Permission/OD', icon: '✔', action: 'apply-perm' },
      { id: 'req-att', label: 'Attendance', icon: '📅', action: 'apply-att' },
    ],
  },
  {
    id: 'status', icon: '📊', label: 'STATUS', type: 'group',
    children: [
      { id: 'st-leave', label: 'Leave', icon: '⊞', page: 'status-leave' },
      { id: 'st-perm', label: 'Permission/OD', icon: '📄', page: 'status-perm' },
      { id: 'st-att', label: 'Attendance', icon: '▶', page: 'status-att' },
    ],
  },
  { id: 'muster', icon: '📄', label: 'EMPLOYEE MUSTER', type: 'link' },
];

function Sidebar({ activePage, onNavigate, onAction, openGroups, toggleGroup }) {
  return (
    <nav className="ess-sidebar">
      <div className="ess-sidebar-menu-label">MENU</div>
      {NAV.map(item => {
        if (item.type === 'link') {
          return (
            <button key={item.id}
              className={`ess-nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}>
              <span className="ess-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              <span className="ess-nav-arrow">›</span>
            </button>
          );
        }
        const open = openGroups[item.id];
        return (
          <div key={item.id}>
            <button className={`ess-nav-item ${open ? 'open' : ''}`} onClick={() => toggleGroup(item.id)}>
              <span className="ess-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              <span className="ess-nav-arrow" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
            </button>
            {open && (
              <div className="ess-nav-submenu">
                {item.children.map(child => (
                  <button key={child.id}
                    className={`ess-nav-subitem ${activePage === child.page ? 'active' : ''}`}
                    onClick={() => child.action ? onAction(child.action) : onNavigate(child.page)}>
                    <span className="ess-nav-subicon">{child.icon}</span>
                    <span>{child.label}</span>
                    <span className="ess-nav-arrow">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/* ─── Main Employee Dashboard ─── */
export default function EmployeeDashboard({ actor }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [openGroups, setOpenGroups] = useState({ request: false, status: false });
  const [modal, setModal] = useState(null); // 'apply-leave' | 'apply-perm' | 'apply-att'

  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [permRecords, setPermRecords] = useState([]);
  const [attRecords, setAttRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [lr, pr, ar] = await Promise.all([
        fetch('/api/leave/my', { cache: 'no-store' }).then(r => r.ok ? r.json() : { leaves: [] }),
        fetch('/api/leave/permission/my', { cache: 'no-store' }).then(r => r.ok ? r.json() : { records: [] }),
        fetch('/api/leave/attendance/my', { cache: 'no-store' }).then(r => r.ok ? r.json() : { records: [] }),
      ]);
      setLeaves(lr.leaves || []);
      setBalance(lr.balance || null);
      setPermRecords(pr.records || []);
      setAttRecords(ar.records || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function toggleGroup(id) {
    setOpenGroups(g => ({ ...g, [id]: !g[id] }));
  }

  function onAction(action) {
    setModal(action);
  }

  function onNavigate(page) {
    setActivePage(page);
  }

  async function signout() {
    await fetch('/api/leave/session', { method: 'DELETE' });
    window.location.assign('/leave/login');
  }

  return (
    <div className="ess-shell">
      {/* Topbar */}
      <header className="ess-topbar">
        <div className="ess-topbar-brand">
          <img src="/codeemy-technologies.png" alt="CodeEmy" height={36} />
        </div>
        <div className="ess-topbar-right">
          <span className="ess-topbar-name">{actor.full_name}</span>
          <span className="ess-topbar-role">Employee</span>
          <button className="ess-signout-btn" onClick={signout}>Sign Out</button>
        </div>
      </header>

      <div className="ess-body">
        {/* Sidebar */}
        <Sidebar
          activePage={activePage}
          onNavigate={onNavigate}
          onAction={onAction}
          openGroups={openGroups}
          toggleGroup={toggleGroup}
        />

        {/* Main Content */}
        <main className="ess-content">
          <div className="ess-breadcrumb">
            Home › {activePage === 'dashboard' ? 'Dashboard' :
                    activePage === 'muster' ? 'Employee Muster' :
                    activePage === 'status-leave' ? 'Status › Leave' :
                    activePage === 'status-perm' ? 'Status › Permission/OD' :
                    activePage === 'status-att' ? 'Status › Attendance' : activePage}
          </div>

          {/* Emp Info */}
          <div className="ess-emp-info">
            <span>Emp Name: <strong>{actor.full_name}</strong></span>
            <span>Role: <strong>{ROLE_LABELS[actor.emp_role] || actor.emp_role}</strong></span>
          </div>

          {activePage === 'dashboard' && (
            <DashboardHome actor={actor} leaves={leaves} balance={balance} permRecords={permRecords} attRecords={attRecords} loading={loading} />
          )}

          {activePage === 'status-leave' && (
            <div>
              <h2 className="ess-section-title">Leave Status</h2>
              {loading ? <div className="ess-loading">Loading…</div> : <LeaveStatusTable leaves={leaves} />}
            </div>
          )}

          {activePage === 'status-perm' && (
            <div>
              <h2 className="ess-section-title">View Permission / OD</h2>
              {loading ? <div className="ess-loading">Loading…</div> : <PermissionStatusTable records={permRecords} />}
            </div>
          )}

          {activePage === 'status-att' && (
            <div>
              <h2 className="ess-section-title">Attendance Status</h2>
              {loading ? <div className="ess-loading">Loading…</div> : <AttendanceStatusTable records={attRecords} />}
            </div>
          )}

          {activePage === 'muster' && (
            <div>
              <h2 className="ess-section-title">Employee Muster</h2>
              <EmployeeMuster actorId={actor.id} />
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {modal === 'apply-leave' && (
        <ApplyLeaveForm onClose={() => setModal(null)} onSuccess={() => { setModal(null); loadAll(); }} />
      )}
      {modal === 'apply-perm' && (
        <ApplyPermissionForm onClose={() => setModal(null)} onSuccess={() => { setModal(null); loadAll(); }} />
      )}
      {modal === 'apply-att' && (
        <ApplyAttendanceForm onClose={() => setModal(null)} onSuccess={() => { setModal(null); loadAll(); }} />
      )}
    </div>
  );
}
