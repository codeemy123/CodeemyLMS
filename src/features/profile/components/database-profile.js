'use client';
import { useEffect, useState } from 'react';
import { uploadFile } from '@/lib/uploads';
export default function DatabaseProfile() {
  const [user, setUser] = useState(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/profile', { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setUser(data.user);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  async function save(data) {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setUser(result.user);
    window.dispatchEvent(new Event('codeemy-profile-updated'));
    setMessage('Profile saved.');
  }
  if (!user) return <p role="status">{message || 'Loading your profile?'}</p>;
  return (
    <section className="card" style={{ padding: 28 }}>
      <h2>{user.full_name}</h2>
      <p>
        {user.email} ? {user.role}
      </p>
      <form
        className="profile-photo-editor"
        onSubmit={async (event) => {
          event.preventDefault();
          const file = new FormData(event.currentTarget).get('photo');
          if (
            !file?.size ||
            !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) ||
            file.size > 5242880
          ) {
            setMessage('Choose a PNG, JPG, WebP or GIF up to 5 MB.');
            return;
          }
          setBusy(true);
          try {
            const uploaded = await uploadFile(file);
            await save({ photo: uploaded.data });
          } catch (e) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="avatar profile-photo-large">
          {user.profile_image ? (
            <img className="profile-avatar-image" alt="Your profile" src={user.profile_image} />
          ) : (
            user.full_name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
          )}
        </div>
        <div>
          <h3>Profile picture</h3>
          <input
            type="file"
            name="photo"
            accept="image/png,image/jpeg,image/webp,image/gif"
            required
          />
          <button disabled={busy} type="submit">
            Upload profile photo
          </button>
          {user.profile_image && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await save({ photo: null });
                } catch (e) {
                  setMessage(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove profile photo
            </button>
          )}
        </div>
      </form>
      <form
        className="auth-form"
        key={user.id + user.full_name + user.phone}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await save(Object.fromEntries(new FormData(e.currentTarget)));
          } catch (error) {
            setMessage(error.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Full name
          <input name="fullName" defaultValue={user.full_name} required maxLength={150} />
        </label>
        <label>
          Phone
          <input name="phone" defaultValue={user.phone || ''} maxLength={20} />
        </label>
        {user.role === 'STUDENT' && (
          <label>
            College name
            <input
              name="collegeName"
              defaultValue={user.student_profiles?.college_name || ''}
              maxLength={255}
            />
          </label>
        )}
        <button disabled={busy}>Save changes</button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
