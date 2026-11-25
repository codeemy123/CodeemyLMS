'use client';
import { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { getLeaveRoleDashboard } from '@/lib/leave-roles';

let pending;
function leaveClientAuth() {
  return (pending ||= (async () => {
    const r = await fetch('/api/auth/config', { cache: 'no-store' });
    const config = await r.json();
    if (!config.configured) throw new Error('Sign-in not configured.');
    const app = getApps().find(a => a.name === 'leave-web') || initializeApp(config.firebase, 'leave-web');
    const auth = getAuth(app);
    await setPersistence(auth, inMemoryPersistence);
    return auth;
  })().catch(e => { pending = null; throw e; }));
}

export default function LeaveLoginPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function loginWithGoogle() {
    setBusy(true); setMessage('');
    try {
      const auth = await leaveClientAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      await signOut(auth);
      const res = await fetch('/api/leave/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || 'Login failed.'); setBusy(false); return; }
      window.location.assign(getLeaveRoleDashboard(data.role));
    } catch (err) {
      setMessage(err.message || 'Login failed. Try again.');
      setBusy(false);
    }
  }

  return (
    <section className="leave-auth-shell">
      <div className="leave-auth-card">
        <div className="leave-auth-brand">
          <img src="/codeemy-technologies.png" alt="CodeEmy" width={180} />
          <h1>Employee Portal</h1>
          <p>Leave Management System</p>
        </div>
        <button className="leave-google-btn" onClick={loginWithGoogle} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/>
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/>
            <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"/>
            <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59A5.99 5.99 0 0 1 12 5.96Z"/>
          </svg>
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>
        {message && <p className="leave-auth-error" role="alert">{message}</p>}
        <p className="leave-auth-note">Use your company Google account. Contact HR if you don't have access.</p>
      </div>
    </section>
  );
}
