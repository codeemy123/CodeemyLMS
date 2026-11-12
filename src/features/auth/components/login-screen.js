'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

const demoAccounts = {
  Student: { email: 'student@codeemy.com', password: 'Student@123' },
  Mentor: { email: 'mentor@codeemy.com', password: 'Mentor@123' },
  Admin: { email: 'admin@codeemy.com', password: 'Admin@123' },
};

export default function LoginScreen() {
  const { role, go, notify } = useWorkspace();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [newAccount, setNewAccount] = useState(null);

  function enterWorkspace(message) {
    go('Dashboard');
    notify(message);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Use a password with at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('The passwords do not match.');
        return;
      }
      setNewAccount({ email: email.trim().toLowerCase(), password });
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      notify('Demo account created in this browser session.');
      return;
    }

    const demo = demoAccounts[role];
    const matchesDemo = email.trim().toLowerCase() === demo.email && password === demo.password;
    const matchesCreated =
      newAccount?.email === email.trim().toLowerCase() && newAccount.password === password;

    if (!matchesDemo && !matchesCreated) {
      setError(
        `Those details do not match the ${role} demo account. Use the demo credentials below.`,
      );
      return;
    }
    enterWorkspace(`Signed in to the ${role} demo workspace.`);
  }

  function useDemoAccount() {
    setEmail(demoAccounts[role].email);
    setPassword(demoAccounts[role].password);
    setMode('login');
    setError('');
  }

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <div className="auth-visual">
          <a className="auth-brand" href="/">
            <Image
              src="/codeemy-technologies.png"
              alt="CodeEmy Technologies"
              width={900}
              height={330}
              unoptimized
              priority
            />
          </a>
          <div className="auth-visual-copy">
            <span className="auth-kicker">YOUR LEARNING JOURNEY</span>
            <h2>
              Make today the day you <span className="auth-headline-accent">move forward.</span>
            </h2>
            <p>
              Learn with confidence, keep track of your progress, and build skills that open doors.
            </p>
            <div className="auth-benefits">
              <span>
                <CheckCircle2 size={17} /> Courses and resources in one place
              </span>
              <span>
                <CheckCircle2 size={17} /> Stay connected with your mentor
              </span>
              <span>
                <CheckCircle2 size={17} /> See your progress as it grows
              </span>
            </div>
          </div>
          <div className="auth-visual-foot">
            <ShieldCheck size={16} /> A welcoming space to learn and grow
          </div>
          <div className="auth-orb auth-orb-one" />
          <div className="auth-orb auth-orb-two" />
        </div>

        <div className="auth-form-panel">
          <div className="auth-role-chip">{role} workspace</div>
          <div className="auth-heading">
            <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p>
              {mode === 'login'
                ? 'Sign in to continue your learning journey.'
                : 'Start your CodeEmy learning journey today.'}
            </p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'selected' : ''}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'selected' : ''}
              onClick={() => {
                setMode('signup');
                setError('');
              }}
            >
              Create account
            </button>
          </div>

          <button
            type="button"
            className="auth-google"
            onClick={() =>
              setError('Google sign-in is not connected in this demo. Use the demo account below.')
            }
          >
            <span className="google-g" aria-hidden="true">
              G
            </span>
            Continue with Google
          </button>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label className="auth-field">
                <span>Full name</span>
                <span className="auth-input-wrap">
                  <UserRound size={17} />
                  <input
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    required
                  />
                </span>
              </label>
            )}
            <label className="auth-field">
              <span>Email address</span>
              <span className="auth-input-wrap">
                <Mail size={17} />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </span>
            </label>
            <label className="auth-field">
              <span>Password</span>
              <span className="auth-input-wrap">
                <LockKeyhole size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'signup' ? 8 : 1}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            {mode === 'signup' && (
              <label className="auth-field">
                <span>Confirm password</span>
                <span className="auth-input-wrap">
                  <LockKeyhole size={17} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Enter password again"
                    required
                  />
                </span>
              </label>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="auth-submit">
              {mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16} />
            </Button>
          </form>

          {mode === 'login' && (
            <div className="auth-demo-box">
              <div>
                <strong>{role} demo access</strong>
                <span>Try the preview with these credentials</span>
              </div>
              <code>{demoAccounts[role].email}</code>
              <code>{demoAccounts[role].password}</code>
              <button type="button" onClick={useDemoAccount}>
                Use demo account <ArrowRight size={14} />
              </button>
            </div>
          )}
          <p className="auth-disclaimer">
            Demo experience only. Sign-in, Google, and account creation are not connected to a
            server.
          </p>
        </div>
      </div>
    </section>
  );
}
