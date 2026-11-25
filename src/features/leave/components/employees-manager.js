'use client';
import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Users } from 'lucide-react';

const ROLES = [
  { value: 'TRAINING_INTERN', label: 'Training Intern' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'FULLTIME', label: 'Fulltime' },
  { value: 'TEAM_LEADER', label: 'TL' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'HR', label: 'HR' },
];

const LEGACY_ROLES = {
  ADMIN: 'Admin',
  EMPLOYEE: 'Employee',
};

export default function EmployeesManager() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', empRole: 'TRAINING_INTERN', department: '', phone: '', teamLeaderId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/leave/employees', { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); setEmployees(d.employees || []); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const teamLeaders = employees.filter(e => ['TEAM_LEADER', 'MANAGER', 'ADMIN'].includes(e.emp_role) && e.status === 'ACTIVE');

  async function addEmployee(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/leave/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add employee.'); setBusy(false); return; }
      setAdding(false);
      setForm({ fullName: '', email: '', empRole: 'TRAINING_INTERN', department: '', phone: '', teamLeaderId: '' });
      load();
    } catch { setError('Network error.'); }
    finally { setBusy(false); }
  }

  async function updateEmployee(id, patch) {
    try {
      const res = await fetch(`/api/leave/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) load();
    } catch {}
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
          Add employees and assign their Team Leader so leave requests route automatically.
        </p>
        <button className="leave-btn primary sm" onClick={() => setAdding(true)}>
          <UserPlus size={15} /> Add Employee
        </button>
      </div>

      {loading ? (
        <div className="leave-loading">Loading employees…</div>
      ) : employees.length === 0 ? (
        <div className="leave-empty">
          <Users size={40} color="#cbd5e1" />
          <p>No employees added yet.</p>
        </div>
      ) : (
        <div className="leave-table-wrap">
          <table className="leave-table">
            <thead>
              <tr>
                <th>Name &amp; Email</th>
                <th>Department</th>
                <th>Role</th>
                <th>Assigned Team Leader</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <strong>{emp.full_name}</strong>
                    <br />
                    <small style={{ color: '#64748b' }}>{emp.email}</small>
                  </td>
                  <td>{emp.department || '—'}</td>
                  <td>
                    <select
                      value={emp.emp_role}
                      onChange={e => updateEmployee(emp.id, { empRole: e.target.value })}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    >
                      {LEGACY_ROLES[emp.emp_role] && (
                        <option value={emp.emp_role}>{LEGACY_ROLES[emp.emp_role]}</option>
                      )}
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      value={emp.team_leader_id || ''}
                      onChange={e => updateEmployee(emp.id, { teamLeaderId: e.target.value || null })}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    >
                      <option value="">No TL assigned</option>
                      {teamLeaders.filter(tl => tl.id !== emp.id).map(tl => (
                        <option key={tl.id} value={tl.id}>{tl.full_name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={emp.status}
                      onChange={e => updateEmployee(emp.id, { status: e.target.value })}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="leave-modal-overlay" onClick={e => e.target === e.currentTarget && setAdding(false)}>
          <div className="leave-modal">
            <div className="leave-modal-header">
              <h2>Add Employee</h2>
              <button type="button" className="leave-modal-close" onClick={() => setAdding(false)}>✕</button>
            </div>
            <form onSubmit={addEmployee} className="leave-form">
              <label className="leave-field">
                <span>Full Name</span>
                <input type="text" required value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Ravi Kumar" />
              </label>
              <label className="leave-field">
                <span>Google Email</span>
                <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ravi@gmail.com" />
              </label>
              <div className="leave-field-row">
                <label className="leave-field">
                  <span>Role</span>
                  <select value={form.empRole} onChange={e => setForm(f => ({ ...f, empRole: e.target.value }))}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </label>
                <label className="leave-field">
                  <span>Department</span>
                  <input type="text" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Engineering" />
                </label>
              </div>
              <label className="leave-field">
                <span>Team Leader (for Employees)</span>
                <select value={form.teamLeaderId} onChange={e => setForm(f => ({ ...f, teamLeaderId: e.target.value }))}>
                  <option value="">Select Team Leader…</option>
                  {teamLeaders.map(tl => <option key={tl.id} value={tl.id}>{tl.full_name} ({tl.email})</option>)}
                </select>
              </label>
              {error && <p className="leave-error" role="alert">{error}</p>}
              <div className="leave-form-actions">
                <button type="button" className="leave-btn secondary" onClick={() => setAdding(false)}>Cancel</button>
                <button type="submit" className="leave-btn primary" disabled={busy}>{busy ? 'Adding…' : 'Add Employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
