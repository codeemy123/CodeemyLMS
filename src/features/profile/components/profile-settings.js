'use client';

import DatabaseProfile from './database-profile';
import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { uploadFile, deleteStoredFile } from '@/lib/uploads';

export default function ProfileSettings() {
  return <DatabaseProfile />;
}

function PreviewProfileSettings() {
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoName, setPhotoName] = useState('');
  const { role, page, tab, setTab, notify, formFields, records, setRecords, workflows } =
    useWorkspace();
  const activeTab = tab === 'All' ? (page === 'Settings' ? 'General' : 'Personal details') : tab;
  const key = `preferences:${role}:${page}:${activeTab}`;
  const name =
    role === 'Student' ? 'Kavin Raj' : role === 'Mentor' ? 'Arjun Kumar' : 'Academy Admin';
  return (
    <div className="card">
      <div className="tabs">
        {(page === 'Settings'
          ? role === 'Admin'
            ? ['General', 'User', 'Academic', 'Notification', 'Certificate', 'Security']
            : ['General', 'Notification', 'Security']
          : ['Personal details', 'Academic details']
        ).map((t) => (
          <button className={tab === t ? 'selected' : ''} key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {page === 'Profile' && ['Student', 'Mentor'].includes(role) && (
        <form
          className="profile-photo-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            if (uploading) return;
            const form = e.currentTarget;
            const file = new FormData(form).get('photo');
            setPhotoError('');
            if (!file?.size) {
              setPhotoError('Choose a profile photo first.');
              return;
            }
            if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
              setPhotoError('Choose a PNG, JPG, WebP or GIF image.');
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              setPhotoError('Choose a photo up to 5 MB.');
              return;
            }
            setUploading(true);
            try {
              const photo = await uploadFile(file);
              setRecords((list) => ({ ...list, [name]: { ...list[name], photo } }));
              form.reset();
              setPhotoName('');
              notify('Profile photo updated');
            } catch (err) {
              setPhotoError(err.message);
            } finally {
              setUploading(false);
            }
          }}
        >
          <div className="avatar profile-photo-large">
            {records[name]?.photo ? (
              <img
                className="profile-avatar-image"
                src={records[name].photo.data}
                alt={`${name} profile photo`}
              />
            ) : (
              <span>{role === 'Student' ? 'KR' : 'AK'}</span>
            )}
          </div>
          <div className="profile-photo-controls">
            <span className="profile-photo-eyebrow">PERSONAL PROFILE</span>
            <h2>Profile picture</h2>
            <p className="profile-photo-description">
              Add a photo so your learning community can recognise you.
            </p>
            <label className="profile-photo-picker">
              <ImagePlus size={18} aria-hidden="true" />
              <span>{photoName || 'Choose a photo'}</span>
              <input
                aria-label="Profile photo"
                name="photo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={uploading}
                onChange={(e) => {
                  setPhotoName(e.target.files?.[0]?.name || '');
                  setPhotoError('');
                }}
              />
            </label>
            <p className="profile-photo-hint">PNG, JPG, WebP or GIF · Up to 5 MB</p>
            {photoError && <p role="alert">{photoError}</p>}
            <div className="profile-photo-actions">
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Uploading photo…' : 'Upload profile photo'}
              </Button>
              {records[name]?.photo && (
                <Button
                  secondary
                  disabled={uploading}
                  onClick={async () => {
                    if (uploading) return;
                    setUploading(true);
                    setPhotoError('');
                    const photo = records[name].photo;
                    try {
                      await deleteStoredFile(photo);
                      setRecords((list) => ({ ...list, [name]: { ...list[name], photo: null } }));
                      notify('Profile photo removed');
                    } catch (err) {
                      setPhotoError(err.message);
                    } finally {
                      setUploading(false);
                    }
                  }}
                >
                  Remove profile photo
                </Button>
              )}
            </div>
          </div>
        </form>
      )}
      <form
        key={key + JSON.stringify({ ...records[key], ...records[name], photo: undefined })}
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          setRecords((list) => ({
            ...list,
            [key]: data,
            ...(page === 'Profile' && activeTab === 'Personal details'
              ? { [name]: { ...list[name], ...data } }
              : {}),
          }));
          notify('Preferences saved in this demo session');
        }}
      >
        {page === 'Profile' ? (
          <>
            <div className="user" style={{ marginBottom: 25 }}>
              <h2>
                {role === 'Student'
                  ? 'Kavin Raj'
                  : role === 'Mentor'
                    ? 'Arjun Kumar'
                    : 'Academy Admin'}
              </h2>
            </div>
            <Badge>{records[name]?.status || 'Active'}</Badge>
            {tab === 'Academic details' ? (
              <div>
                {role === 'Admin' ? (
                  <p>Academy operations and academic administration</p>
                ) : (
                  Object.entries(workflows.batches)
                    .filter(([, b]) =>
                      role === 'Student' ? b.students.includes(name) : b.mentor === name,
                    )
                    .map(([title, b]) => (
                      <div className="activity" key={title}>
                        <strong>{title}</strong>
                        <p>
                          {b.course} · Mentor: {b.mentor}
                        </p>
                      </div>
                    ))
                )}
              </div>
            ) : (
              formFields(
                [
                  'Name',
                  'Email',
                  'Phone',
                  'Location',
                  ...(role === 'Student' ? ['College name'] : []),
                ],
                {
                  ...(records[key] ||
                    records[`preferences:${role}:${page}:All`] || {
                      Name: name,
                      Email: `${role.toLowerCase()}@codeemy.example`,
                      Phone: '9876543210',
                      Location: 'Chennai',
                    }),
                  ...records[name],
                },
              )
            )}
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 20 }}>{tab === 'All' ? 'General' : tab} settings</h2>
            {formFields(
              tab === 'Security'
                ? ['Session timeout (minutes)']
                : tab === 'Certificate'
                  ? ['Certificate prefix', 'Issuer name']
                  : tab === 'Academic'
                    ? ['Academic year', 'Default batch size']
                    : tab === 'Notification'
                      ? ['Notification email']
                      : role === 'Admin'
                        ? ['Organization name', 'Contact email']
                        : ['Name', 'Email'],
              records[key],
            )}
            <label className="choice">
              <input
                type="checkbox"
                name="reminders"
                defaultChecked={records[key] ? records[key].reminders === 'on' : true}
              />{' '}
              {tab === 'Security'
                ? 'Require secure sessions (preview only)'
                : tab === 'Notification'
                  ? 'Enable email notifications'
                  : 'Enable learning reminders'}
            </label>
          </>
        )}
        <Button type="submit">Save changes</Button>
      </form>
    </div>
  );
}
