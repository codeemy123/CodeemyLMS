'use client';
import { useState } from 'react';
import { login, resetPassword, authMessage } from '@/features/auth/client';
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(google = false) {
    setBusy(true);
    setMessage('');
    try {
      window.location.assign(await login(email.trim(), password, google));
    } catch (error) {
      setMessage(authMessage(error));
      setBusy(false);
    }
  }
  return (
    <section className="auth-shell">
      <div className="auth-card">
        <div className="auth-visual">
          <a className="auth-brand" href="/">
            <img src="/codeemy-technologies.png" alt="CodeEmy" width="300" />
          </a>
          <div className="auth-visual-copy">
            <span className="auth-kicker">YOUR LEARNING JOURNEY</span>
            <h2>Welcome to your CodeEmy workspace.</h2>
            <p>Learn, collaborate, and grow with your academy.</p>
          </div>
        </div>
        <div className="auth-form-panel">
          <div className="auth-heading">
            <h1>Welcome back</h1>
            <p>Sign in with your academy account.</p>
          </div>
          <button className="auth-google" disabled={busy} onClick={() => submit(true)}>
            Continue with Google
          </button>
          <div className="auth-divider">
            <span>or continue with email</span>
          </div>
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="auth-field">
              Email address
              <input
                className="auth-input-wrap"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="auth-field">
              Password
              <input
                className="auth-input-wrap"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="auth-submit" disabled={busy} type="submit">
              {busy ? 'Signing in?' : 'Sign in'}
            </button>
            <button
              type="button"
              className="auth-forgot"
              disabled={busy}
              onClick={async () => {
                if (!email.trim()) {
                  setMessage('Enter your email address first.');
                  return;
                }
                setBusy(true);
                try {
                  await resetPassword(email.trim());
                  setMessage('If your account is eligible, a password reset email will arrive.');
                } catch (error) {
                  setMessage(authMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Forgot password?
            </button>
            {message && (
              <p role="alert" className="auth-error">
                {message}
              </p>
            )}
          </form>
          <p className="auth-disclaimer">
            Your administrator assigns your workspace access. Contact your academy if your account
            has not been activated.
          </p>
        </div>
      </div>
    </section>
  );
}
