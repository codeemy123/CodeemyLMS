'use client';
import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, FileText, Clock, CheckCircle2, XCircle, Plus, LogOut, ChevronRight, Upload } from 'lucide-react';
import { LEAVE_ROLE_LABELS as ROLE_LABELS } from '@/lib/leave-roles';

const STATUS_LABELS = {
  PENDING_TL: { label: 'Waiting for TL', color: '#f59e0b', bg: '#fef3c7' },
  PENDING_HR: { label: 'Waiting for HR', color: '#3b82f6', bg: '#dbeafe' },
  PENDING_ADMIN: { label: 'Waiting for Admin', color: '#8b5cf6', bg: '#ede9fe' },
  APPROVED: { label: 'Approved', color: '#10b981', bg: '#d1fae5' },
  REJECTED: { label: 'Rejected', color: '#ef4444', bg: '#fee2e2' },
};

const LEAVE_TYPES = ['SICK', 'CASUAL', 'EMERGENCY', 'OTHER'];

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function ApplyForm({ onClose, onSuccess }) {
  const [form, setForm] = useState({ leaveType: 'SICK', fromDate: '', toDate: '', subject: '', reason: '', documentUrl: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await fetch('/api/leave/upload', {
        method: 'POST',
        headers: {
          'x-file-name': encodeURIComponent(file.name),
          'content-type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'File upload failed.');
        setUploading(false);
        return;
      }
      setForm(f => ({ ...f, documentUrl: data.url }));
      setUploadedName(file.name);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/api/leave/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to submit.'); setBusy(false); return; }
      onSuccess();
    } catch { setError('Network error. Try again.'); setBusy(false); }
  }

  return (
    <div className="leave-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="leave-modal">
        <div className="leave-modal-header">
          <h2>Apply for Leave</h2>
          <button type="button" className="leave-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="leave-form">
          <label className="leave-field">
            <span>Leave Type</span>
            <select value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))} required>
              {LEAVE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()} Leave</option>)}
            </select>
          </label>
          <div className="leave-field-row">
            <label className="leave-field">
              <span>From Date</span>
              <input type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} required />
            </label>
            <label className="leave-field">
              <span>To Date</span>
              <input type="date" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} required />
            </label>
          </div>
          <label className="leave-field">
            <span>Subject</span>
            <input type="text" placeholder="Brief reason (e.g. Fever, Family emergency)" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required maxLength={255} />
          </label>
          <label className="leave-field">
            <span>Detailed Reason</span>
            <textarea rows={4} placeholder="Explain your reason in detail..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required />
          </label>
          <label className="leave-field">
            <span>Medical Certificate / Supporting Image or PDF <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></span>
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={handleFileUpload} disabled={uploading} />
            {uploading && <small style={{ color: '#4f46e5' }}>Uploading document…</small>}
            {uploadedName && !uploading && <small style={{ color: '#10b981' }}>✓ Uploaded: {uploadedName}</small>}
          </label>
          {error && <p className="leave-error" role="alert">{error}</p>}
          <div className="leave-form-actions">
            <button type="button" className="leave-btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="leave-btn primary" disabled={busy || uploading}>{busy ? 'Submitting…' : 'Submit Leave'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeaveTimeline({ leave }) {
  const steps = [
    { label: 'Applied', done: true, date: leave.created_at, note: null, action: null },
    { label: 'Team Leader', done: !!leave.tl_action, date: leave.tl_reviewed_at, note: leave.tl_note, action: leave.tl_action },
    { label: 'HR', done: !!leave.hr_action, date: leave.hr_reviewed_at, note: leave.hr_note, action: leave.hr_action },
    { label: 'Management', done: !!leave.admin_action, date: leave.admin_reviewed_at, note: leave.admin_note, action: leave.admin_action },
  ];
  return (
    <div className="leave-timeline">
      {steps.map((s, i) => (
        <div key={i} className={`leave-timeline-step ${s.done ? (s.action === 'REJECT' ? 'rejected' : 'done') : 'pending'}`}>
          <div className="leave-timeline-dot" />
          <div className="leave-timeline-content">
            <strong>{s.label}</strong>
            {s.action && <span className={`leave-tl-action ${s.action === 'REJECT' ? 'reject' : 'approve'}`}>{s.action === 'APPROVE' ? '✓ Approved' : '✗ Rejected'}</span>}
            {s.note && <p className="leave-tl-note">"{s.note}"</p>}
            {s.date && <small>{new Date(s.date).toLocaleDateString('en-IN')}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EmployeeDashboard({ actor }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/leave/my', { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); setLeaves(d.leaves || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = {
    total: leaves.length,
    approved: leaves.filter(l => l.status === 'APPROVED').length,
    pending: leaves.filter(l => l.status.startsWith('PENDING')).length,
    rejected: leaves.filter(l => l.status === 'REJECTED').length,
  };

  async function signout() {
    await fetch('/api/leave/session', { method: 'DELETE' });
    window.location.assign('/leave/login');
  }

  return (
    <div className="leave-shell">
      <header className="leave-topbar">
        <div className="leave-topbar-brand">
          <img src="/codeemy-technologies.png" alt="CodeEmy" width={120} />
          <span className="leave-role-chip">{ROLE_LABELS[actor.emp_role] || 'Employee'}</span>
        </div>
        <div className="leave-topbar-right">
          <span className="leave-user-name">👤 {actor.full_name}</span>
          <button className="leave-signout-btn" onClick={signout}><LogOut size={15} /> Sign out</button>
        </div>
      </header>

      <main className="leave-main">
        <div className="leave-page-header">
          <div>
            <h1>My Leaves</h1>
            <p>Track your leave applications and their approval status.</p>
          </div>
          <button className="leave-btn primary" onClick={() => setApplying(true)}>
            <Plus size={16} /> Apply for Leave
          </button>
        </div>

        <div className="leave-stat-grid">
          {[
            { label: 'Total Applied', value: stats.total, icon: FileText, color: '#6366f1' },
            { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: '#10b981' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: '#f59e0b' },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} className="leave-stat-card">
              <s.icon size={24} color={s.color} />
              <div>
                <div className="leave-stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="leave-stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="leave-loading">Loading your applications…</div>
        ) : leaves.length === 0 ? (
          <div className="leave-empty">
            <CalendarDays size={48} color="#d1d5db" />
            <p>No leave applications yet.</p>
            <button className="leave-btn primary" onClick={() => setApplying(true)}><Plus size={16} /> Apply Now</button>
          </div>
        ) : (
          <div className="leave-table-wrap">
            <table className="leave-table">
              <thead>
                <tr><th>Type</th><th>Subject</th><th>From</th><th>To</th><th>Applied</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id}>
                    <td><span className="leave-type-chip">{l.leave_type}</span></td>
                    <td>{l.subject}</td>
                    <td>{new Date(l.from_date).toLocaleDateString('en-IN')}</td>
                    <td>{new Date(l.to_date).toLocaleDateString('en-IN')}</td>
                    <td>{new Date(l.created_at).toLocaleDateString('en-IN')}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td><button className="leave-view-btn" onClick={() => setSelected(l)}><ChevronRight size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {applying && (
        <ApplyForm
          onClose={() => setApplying(false)}
          onSuccess={() => { setApplying(false); load(); }}
        />
      )}

      {selected && (
        <div className="leave-modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="leave-modal">
            <div className="leave-modal-header">
              <h2>{selected.subject}</h2>
              <button type="button" className="leave-modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="leave-detail">
              <div className="leave-detail-row"><span>Type</span><span className="leave-type-chip">{selected.leave_type}</span></div>
              <div className="leave-detail-row"><span>Dates</span><span>{new Date(selected.from_date).toLocaleDateString('en-IN')} → {new Date(selected.to_date).toLocaleDateString('en-IN')}</span></div>
              <div className="leave-detail-row"><span>Status</span><StatusBadge status={selected.status} /></div>
              <p className="leave-reason-text">{selected.reason}</p>
              {selected.document_url && <a href={selected.document_url} target="_blank" rel="noreferrer" className="leave-doc-link"><Upload size={14} /> View Document</a>}
              <h3 style={{ marginTop: 20 }}>Approval Timeline</h3>
              <LeaveTimeline leave={selected} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
