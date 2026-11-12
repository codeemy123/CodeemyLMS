'use client';
import { useState } from 'react';
import { Mail, LockKeyhole, Eye, EyeOff, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import { login, resetPassword, authMessage } from '@/features/auth/client';
import RegistrationScreen from '@/features/auth/components/registration-screen';
export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [googleProfile, setGoogleProfile] = useState(null);
  async function submit(google = false) {
    setBusy(true);
    setMessage('');
    try {
      const result = await login(email.trim(), password, google);
      if (typeof result === 'string') window.location.assign(result);
      else {
        setGoogleProfile(result.profile);
        setBusy(false);
      }
    } catch (error) {
      setMessage(authMessage(error));
      setBusy(false);
    }
  }
  if (googleProfile)
    return (
      <RegistrationScreen
        initialGoogleProfile={googleProfile}
        onCancel={() => setGoogleProfile(null)}
      />
    );
  return (
    <section className="auth-shell login-warm">
      <div className="auth-card">
        <div className="auth-visual">
          <a className="auth-brand" href="/">
            <img src="/codeemy-technologies.png" alt="CodeEmy" width="300" />
          </a>
          <div className="auth-visual-copy">
            <span className="auth-kicker">YOUR LEARNING JOURNEY</span>
            <h2>
              Your next chapter
              <br />
              looks <span className="login-highlight">bright.</span>
            </h2>
            <p>
              Big ideas. New skills. Endless possibilities. Step into your CodeEmy learning journey.
            </p>
            <div className="login-hero-chips">
              <span>
                <Sparkles size={14} /> Learn with purpose
              </span>
              <span>
                <ShieldCheck size={14} /> Grow with confidence
              </span>
            </div>
          </div>
        </div>
        <div className="auth-form-panel">
          <div className="auth-heading">
            <h1>Welcome back</h1>
            <p>Sign in with your academy account.</p>
            <p className="registration-link">
              New to CodeEmy?{' '}
              <a href="/register">
                Create an account <ArrowRight size={13} />
              </a>
            </p>
          </div>
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="auth-field">
              <span>Email address</span>
              <span className="auth-input-wrap">
                <Mail size={17} />
                <input
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </span>
            </label>
            <label className="auth-field">
              <span>Password</span>
              <span className="auth-input-wrap">
                <LockKeyhole size={17} />
                <input
                  placeholder="Enter your password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            <button className="auth-submit" disabled={busy} type="submit">
              {busy ? 'Signing in...' : 'Sign in'}
              <ArrowRight size={17} />
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
          <div className="auth-divider">
            <span>or sign in with Google</span>
          </div>
          <button className="auth-google" disabled={busy} onClick={() => submit(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59A5.99 5.99 0 0 1 12 5.96Z"
              />
            </svg>
            Continue with Google
          </button>
          <p className="auth-disclaimer">
            Your administrator assigns your workspace access. Contact your academy if your account
            has not been activated.
          </p>
        </div>
      </div>
    </section>
  );
}
