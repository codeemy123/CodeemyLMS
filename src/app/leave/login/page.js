'use client';
import { useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  inMemoryPersistence,
} from 'firebase/auth';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function exchangeToken(idToken) {
    const res = await fetch('/api/leave/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Login failed.');
      setBusy(false);
      return;
    }
    window.location.assign(getLeaveRoleDashboard(data.role));
  }

  async function loginWithGoogle() {
    setBusy(true); setMessage('');
    try {
      const auth = await leaveClientAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const idToken = await cred.user.getIdToken();
      await signOut(auth);
      await exchangeToken(idToken);
    } catch (err) {
      setMessage(err.message || 'Login failed. Try again.');
      setBusy(false);
    }
  }

  async function loginWithPassword(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setMessage('Enter your email and password.');
      return;
    }
    setBusy(true); setMessage('');
    try {
      const auth = await leaveClientAuth();
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      await signOut(auth);
      await exchangeToken(idToken);
    } catch (err) {
      setMessage(err.code === 'auth/invalid-credential' ? 'Invalid email or password.' : (err.message || 'Login failed.'));
      setBusy(false);
    }
  }

  return (
    <section className="leave-auth-shell">
      <div className="leave-auth-card">
        <div className="leave-auth-brand">
          <img src="/codeemy-technologies.png" alt="CodeEmy" width={180} />
          <h1>Employee Portal</h1>
          <p>Leave, Permission/OD &amp; Attendance</p>
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

        <div style={{ textAlign: 'center', margin: '14px 0', color: '#94a3b8', fontSize: 12 }}>or sign in with email</div>

        <form onSubmit={loginWithPassword} className="leave-form" style={{ textAlign: 'left' }}>
          <label className="leave-field">
            <span>Company Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" required />
          </label>
          <label className="leave-field">
            <span>Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
          </label>
          <button type="submit" className="leave-btn primary" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'Signing in…' : 'Sign in with Email'}
          </button>
        </form>

        {message && <p className="leave-auth-error" role="alert">{message}</p>}
        <p className="leave-auth-note">Use the email added by your HR / Admin. You will be routed automatically to your assigned dashboard.</p>
      </div>
    </section>
  );
}
