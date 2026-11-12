'use client';
import { useState } from 'react';
import { UserPlus, ArrowRight, ShieldCheck } from 'lucide-react';
export default function AccountMapping({ fixedRole, onActivated }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="academy-panel academy-account-panel">
      <div className="academy-panel-heading">
        <div>
          <span className="academy-overline">GROW YOUR COMMUNITY</span>
          <h2>Add academy access</h2>
        </div>
        <span className="academy-icon sage">
          <UserPlus size={21} />
        </span>
      </div>
      <p className="academy-form-intro">
        Connect an existing Firebase account to its academy workspace.
      </p>
      <form
        className="auth-form academy-account-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = Object.fromEntries(new FormData(form));
          if (fixedRole) data.role = fixedRole;
          setBusy(true);
          try {
            const response = await fetch('/api/admin/accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            setMessage(result.user.email + ' activated as ' + result.user.role);
            form.reset();
            onActivated?.();
          } catch (error) {
            setMessage(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Full name
          <input
            name="fullName"
            placeholder="e.g. Arjun Kumar"
            autoComplete="name"
            required
            maxLength={150}
          />
        </label>
        <label>
          Firebase UID
          <input
            name="firebaseUid"
            placeholder="Paste the user UID"
            autoComplete="off"
            required
            maxLength={128}
          />
        </label>
        <label>
          Role
          <select
            aria-label="Role"
            name="role"
            value={fixedRole || undefined}
            disabled={!!fixedRole}
          >
            {(!fixedRole || fixedRole === 'STUDENT') && <option value="STUDENT">Student</option>}
            {(!fixedRole || fixedRole === 'MENTOR') && <option value="MENTOR">Mentor</option>}
          </select>
        </label>
        <button className="btn" disabled={busy}>
          {busy ? 'Activating...' : 'Activate account'}
          <ArrowRight size={16} />
        </button>
        {message && <p role="status">{message}</p>}
      </form>
      <p className="academy-form-note">
        <ShieldCheck size={14} /> Workspace permissions follow the assigned role.
      </p>
    </section>
  );
}
