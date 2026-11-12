'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Trash2,
  UserRound,
  ShieldCheck,
  Mail,
  CheckCircle2,
  Pencil,
  LogOut,
} from 'lucide-react';
import { uploadFile } from '@/lib/uploads';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function DatabaseProfile() {
  const { signOut } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const detailsForm = useRef(null);
  const [user, setUser] = useState(null);
  const [capabilities, setCapabilities] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const photoInput = useRef(null);
  async function load() {
    setError('');
    try {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load your profile.');
      setUser(data.user);
      setCapabilities(data.capabilities || {});
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function save(data) {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to save your profile.');
    setUser(result.user);
    setCapabilities(result.capabilities || {});
    window.dispatchEvent(new Event('codeemy-profile-updated'));
  }
  async function perform(action, success) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function savePhoto(selected) {
    await perform(async () => {
      const uploaded = await uploadFile(selected);
      await save({ photo: uploaded.data });
      setFile(null);
      if (photoInput.current) photoInput.current.value = '';
    }, 'Profile photo saved. It will stay after refresh.');
  }
  if (!user)
    return (
      <section className="profile-loading card">
        <UserRound size={28} />
        <h2>Your personal space</h2>
        <p role={error ? 'alert' : 'status'}>{error || 'Loading your profile…'}</p>
        {error && (
          <button className="btn" onClick={load}>
            Try again
          </button>
        )}
      </section>
    );
  const initials = user.full_name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
  const roleName = user.role.charAt(0) + user.role.slice(1).toLowerCase();
  const joinedAt =
    user.student_profiles?.admission_date || user.mentor_profiles?.created_at || user.created_at;
  return (
    <div className="personal-profile">
      <aside className="profile-identity-card">
        <span className="profile-section-label">YOUR CODEEMY IDENTITY</span>
        <div className="profile-portrait">
          {preview || user.profile_image ? (
            <img src={preview || user.profile_image} alt={`${user.full_name}'s profile`} />
          ) : (
            <span>{initials}</span>
          )}
          <button
            type="button"
            className="profile-camera-mark"
            aria-label="Change profile photo"
            disabled={busy}
            onClick={() => photoInput.current?.click()}
          >
            <Camera size={17} />
          </button>
        </div>
        <h2>{user.full_name}</h2>
        <span className="profile-role-pill">{roleName}</span>
        <p className="profile-identity-email">
          <Mail size={15} />
          {user.email}
        </p>
        <div className="profile-status">
          <ShieldCheck size={16} />
          {user.status === 'ACTIVE' ? 'Active academy account' : user.status}
        </div>
        <div className="profile-photo-controls-new">
          <label className="profile-choose-photo">
            <Camera size={17} />
            Choose a photo
            <input
              ref={photoInput}
              aria-label="Profile photo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={busy}
              onChange={(e) => {
                const selected = e.target.files?.[0];
                setError('');
                setMessage('');
                if (!selected) return;
                if (
                  !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(selected.type) ||
                  selected.size > 5242880
                ) {
                  setError('Choose a PNG, JPG, WebP or GIF up to 5 MB.');
                  e.target.value = '';
                  return;
                }
                setFile(selected);
                savePhoto(selected);
              }}
            />
          </label>
          <small>
            {file
              ? busy
                ? 'Saving your photo…'
                : 'Photo not saved. Please retry below.'
              : 'PNG, JPG, WebP or GIF · Maximum 5 MB · Saves automatically'}
          </small>
          {file && (
            <button className="btn" disabled={busy} onClick={() => savePhoto(file)}>
              <Upload size={16} />
              {busy ? 'Saving…' : 'Retry photo upload'}
            </button>
          )}
          {(user.profile_image || file) && (
            <button
              className="profile-remove-photo"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  if (user.profile_image) await save({ photo: null });
                  setFile(null);
                  if (photoInput.current) photoInput.current.value = '';
                }, 'Profile photo removed.')
              }
            >
              <Trash2 size={15} />
              Remove profile photo
            </button>
          )}
        </div>
        <div className="profile-signout-section">
          <button
            type="button"
            className="profile-signout-button"
            disabled={busy || signingOut}
            onClick={async () => {
              setSigningOut(true);
              setError('');
              try {
                if ((await signOut()) === false) setSigningOut(false);
              } catch (e) {
                setError(e.message || 'Unable to sign out. Please try again.');
                setSigningOut(false);
              }
            }}
          >
            <LogOut size={19} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
          <small>Securely sign out of your CodeEmy account.</small>
        </div>
      </aside>
      <section className="profile-details-card">
        <div className="profile-details-heading">
          <span className="profile-heading-icon">
            <UserRound size={24} />
          </span>
          <div>
            <h2>Personal details</h2>
            <p>
              {editing
                ? 'Update your details, then save your changes.'
                : 'Your saved account details. Select Edit profile to make changes.'}
            </p>
          </div>
          {!editing && (
            <button
              type="button"
              className="btn secondary profile-edit-button"
              disabled={busy || signingOut}
              onClick={() => {
                setEditing(true);
                setMessage('');
                setError('');
              }}
            >
              <Pencil size={16} /> Edit profile
            </button>
          )}
        </div>
        <form
          ref={detailsForm}
          key={
            user.id +
            user.full_name +
            (user.phone || '') +
            (user.student_profiles?.college_name || '') +
            (user.student_profiles?.department || '')
          }
          onSubmit={(e) => {
            e.preventDefault();
            if (!editing || busy) return;
            const data = Object.fromEntries(new FormData(e.currentTarget));
            perform(async () => {
              await save(data);
              setEditing(false);
            }, 'Your personal details have been saved.');
          }}
        >
          <div className="profile-details-grid">
            {user.role === 'STUDENT' && (
              <label>
                Registration number
                <input
                  value={user.student_profiles?.registration_number || 'Not assigned'}
                  readOnly
                />
              </label>
            )}
            <label>
              {user.role === 'STUDENT' ? 'Admission date & time' : 'Account created'}
              <input
                value={
                  joinedAt
                    ? new Intl.DateTimeFormat('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Kolkata',
                      }).format(new Date(joinedAt)) + ' IST'
                    : 'Not available'
                }
                readOnly
              />
              <small>First account creation · managed automatically.</small>
            </label>
            <label>
              Full name
              <input
                name="fullName"
                readOnly={!editing}
                defaultValue={user.full_name}
                autoComplete="name"
                required
                maxLength={150}
                disabled={busy}
              />
            </label>
            <label>
              Email address
              <input value={user.email} type="email" readOnly />
              <small>Your academy sign-in email.</small>
            </label>
            <label>
              Phone number
              <input
                name="phone"
                readOnly={!editing}
                defaultValue={user.phone || ''}
                type="tel"
                autoComplete="tel"
                maxLength={20}
                placeholder="Add your phone number"
                disabled={busy}
              />
            </label>
            <label>
              Workspace role
              <input value={roleName} readOnly />
            </label>
            {user.role === 'STUDENT' && capabilities.collegeName && (
              <label>
                College / institution
                <input
                  name="collegeName"
                  readOnly={!editing}
                  defaultValue={user.student_profiles?.college_name || ''}
                  maxLength={255}
                  placeholder="Your college or institution"
                  disabled={busy}
                />
              </label>
            )}
            {user.role === 'STUDENT' && (
              <label>
                Department
                <input
                  name="department"
                  readOnly={!editing}
                  defaultValue={user.student_profiles?.department || ''}
                  maxLength={150}
                  placeholder="e.g. Computer Science"
                  disabled={busy}
                />
              </label>
            )}
            {user.role === 'MENTOR' && (
              <label className="profile-wide">
                Qualification / expertise
                <input value={user.mentor_profiles?.qualification || 'Not provided'} readOnly />
              </label>
            )}
          </div>
          <div className="profile-save-row">
            <p>
              <ShieldCheck size={16} />
              Your account role is managed by your academy.
            </p>
            {editing && (
              <div className="profile-edit-actions">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    detailsForm.current?.reset();
                    setEditing(false);
                    setError('');
                  }}
                >
                  Cancel
                </button>
                <button className="btn" disabled={busy} type="submit">
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </div>
        </form>
      </section>
      {message && (
        <p className="profile-feedback success" role="status">
          <CheckCircle2 size={18} />
          {message}
        </p>
      )}
      {error && (
        <p className="profile-feedback error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
