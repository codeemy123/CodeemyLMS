'use client';
import { useState } from 'react';
import { ArrowRight, ShieldCheck, Clock3, CheckCircle2, GraduationCap, Users } from 'lucide-react';
import { registerAccount, authMessage } from '@/features/auth/client';
export default function Register() {
  const [role, setRole] = useState('STUDENT'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [submitted, setSubmitted] = useState(false);
  async function submit(event, google = false) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    if (!google && data.password !== data.confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await registerAccount({ ...data, role }, google);
      setSubmitted(true);
    } catch (error) {
      setMessage(authMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="registration-shell">
      <a className="registration-brand" href="/login">
        <img src="/codeemy-technologies.png" alt="CodeEmy" width="170" />
      </a>
      <main className="registration-card">
        <div className="registration-intro">
          <span className="academy-overline">A BRIGHTER CHAPTER STARTS HERE</span>
          <h1>{submitted ? 'You are on the list.' : 'Join your academy.'}</h1>
          <p>
            {submitted
              ? 'Your registration has been sent for review.'
              : 'Create your account. Your academy administrator will verify your details before activating access.'}
          </p>
        </div>
        {submitted ? (
          <div className="registration-success">
            <span className="academy-icon sage">
              <CheckCircle2 size={30} />
            </span>
            <h2>Waiting for approval</h2>
            <p>
              You cannot enter a workspace until an administrator approves your request. Sign in
              later to check your access; a declined request will show the review reason.
            </p>
            <a className="btn" href="/login">
              Back to sign in <ArrowRight size={16} />
            </a>
          </div>
        ) : (
          <>
            <div className="registration-role-picker" aria-label="Choose your role">
              {[
                ['STUDENT', 'Student', GraduationCap],
                ['MENTOR', 'Mentor', Users],
              ].map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={role === value}
                  onClick={() => setRole(value)}
                  className={role === value ? 'selected' : ''}
                >
                  <Icon size={20} />
                  <span>
                    {label}
                    <small>
                      {value === 'STUDENT'
                        ? 'Learn and build new skills'
                        : 'Guide and support learners'}
                    </small>
                  </span>
                  {role === value && <CheckCircle2 size={17} />}
                </button>
              ))}
            </div>
            <form className="auth-form registration-form" onSubmit={(event) => submit(event)}>
              <div className="registration-fields">
                <label>
                  Full name
                  <input
                    name="fullName"
                    required
                    maxLength={150}
                    autoComplete="name"
                    placeholder="Your full name"
                  />
                </label>
                <label>
                  Phone
                  <input
                    name="phone"
                    required
                    maxLength={20}
                    autoComplete="tel"
                    type="tel"
                    placeholder="Contact number"
                  />
                </label>
                <label>
                  Email address
                  <input
                    name="email"
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </label>
                {role === 'STUDENT' ? (
                  <label>
                    College / institution
                    <input
                      name="college"
                      maxLength={250}
                      placeholder="Your college or institution"
                    />
                  </label>
                ) : (
                  <label>
                    Qualification / expertise
                    <input
                      name="qualification"
                      maxLength={500}
                      placeholder="Your background and expertise"
                    />
                  </label>
                )}
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                  />
                </label>
                <label>
                  Confirm password
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                    placeholder="Enter password again"
                  />
                </label>
              </div>
              <label>
                A note for your academy <span className="registration-optional">(optional)</span>
                <textarea
                  name="message"
                  maxLength={2000}
                  rows={3}
                  placeholder="Tell us a little about yourself"
                />
              </label>
              <p className="registration-review-note">
                <ShieldCheck size={18} /> Your requested role requires Admin approval. Registration
                does not grant immediate access.
              </p>
              {message && (
                <p role="alert" className="auth-error">
                  {message}
                </p>
              )}
              <button className="btn" disabled={busy}>
                {busy ? 'Submitting...' : 'Request academy access'}
                <ArrowRight size={16} />
              </button>
              <div className="auth-divider">
                <span>already have a Google account?</span>
              </div>
              <button
                className="auth-google"
                type="button"
                disabled={busy}
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  const password = form.elements.password,
                    confirm = form.elements.confirmPassword,
                    email = form.elements.email;
                  password.required = false;
                  confirm.required = false;
                  email.required = false;
                  const request = { preventDefault() {}, currentTarget: form };
                  submit(request, true);
                  password.required = true;
                  confirm.required = true;
                  email.required = true;
                }}
              >
                Register with Google
              </button>
              <p className="registration-signin">
                Already registered? <a href="/login">Sign in</a>
              </p>
            </form>
          </>
        )}
        <div className="registration-footer">
          <Clock3 size={14} /> Access is activated after your academy reviews your request.
        </div>
      </main>
    </section>
  );
}
