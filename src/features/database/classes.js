'use client';

import AdminRecordActions from '@/features/management/components/admin-record-editor';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ImagePlus,
  Plus,
  Tags,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ClassRecordings from './class-recordings';
import { api } from './api';
import { uploadFile } from '@/lib/uploads';

const IST = 'Asia/Kolkata';

function calendarDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DatabaseClasses({ mode = 'class' }) {
  const { role, go } = useWorkspace();
  const isLive = mode === 'live';
  const sessionLabel = mode === 'webinar' ? 'webinar' : isLive ? 'live class' : 'class';
  const sessionLabelTitle = sessionLabel[0].toUpperCase() + sessionLabel.slice(1);
  const sessionLabelPlural = mode === 'webinar' ? 'webinars' : isLive ? 'live classes' : 'classes';
  const [loading, setLoading] = useState(true);
  const [batchesLoading, setBatchesLoading] = useState(role === 'Admin');
  const [batches, setBatches] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState('success');
  const [showForm, setShowForm] = useState(!isLive);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');

  const refreshSessions = async () => setSessions((await api('/api/class-sessions')).sessions);

  useEffect(() => {
    if (role !== 'Admin') return;
    api('/api/batches')
      .then((data) => setBatches(data.batches))
      .catch((error) => {
        setMessageKind('error');
        setMessage(error.message);
      })
      .finally(() => setBatchesLoading(false));
  }, [role]);

  useEffect(() => {
    refreshSessions().catch((error) => {
      setMessageKind('error');
      setMessage(error.message);
    }).finally(() => setLoading(false));
  }, []);

  const visibleSessions = useMemo(
    () => (isLive ? sessions.filter((session) => session?.metadata?.sessionType !== 'webinar') : sessions),
    [isLive, sessions],
  );

  const calendarDays = useMemo(() => {
    if (!isLive) return [];
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const count = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
    return Array.from({ length: first.getDay() + count }, (_, index) => {
      const day = index - first.getDay() + 1;
      return day > 0 ? new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day) : null;
    });
  }, [isLive, monthCursor]);

  const openLiveForm = (value = '') => {
    setSelectedDate(value);
    setSelectedBatchId('');
    setThumbnailFile(null);
    setThumbnailPreview('');
    setShowForm(true);
  };

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId);

  const closeLiveForm = (force = false) => {
    if (busy && !force) return;
    setShowForm(false);
    setSelectedDate('');
    setSelectedBatchId('');
    setThumbnailFile(null);
    setThumbnailPreview('');
  };

  const pickThumbnail = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setMessageKind('error');
      setMessage('Choose a PNG, JPG, WebP or GIF image smaller than 5 MB.');
      event.target.value = '';
      return;
    }
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const scheduleSession = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setMessage('');
    try {
      if (isLive) {
        const start = new Date(`${data.startDate}T${data.startTime}`);
        const end = new Date(`${data.endDate}T${data.endTime}`);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
          throw new Error('Choose a valid end time after the class start time.');
        data.startAt = start.toISOString();
        data.endAt = end.toISOString();
        data.durationMinutes = String(Math.round((end.getTime() - start.getTime()) / 60_000));
        data.createZoom = 'true';
        data.tags = String(data.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        if (thumbnailFile) {
          const uploaded = await uploadFile(thumbnailFile, { courseId: selectedBatch?.course_id });
          data.thumbnailUrl = uploaded?.data || '';
        }
      } else {
        data.startAt = new Date(data.startAt).toISOString();
      }
      const created = await api('/api/class-sessions', { method: 'POST', body: JSON.stringify(data) });
      await refreshSessions();
      form.reset();
      if (isLive) closeLiveForm(true);
      setMessageKind('success');
      const invitations = created?.invitations;
      const invitationStatus = invitations?.recipients
        ? invitations.emailConfigured
          ? invitations.sent
            ? ` Professional email invitations were sent to ${invitations.sent} recipient${invitations.sent === 1 ? '' : 's'}.`
            : ' Email delivery could not be completed, but in-app notifications are available.'
          : ' In-app notifications were sent. Email delivery is not configured yet.'
        : '';
      setMessage((isLive ? 'Your Zoom meeting is ready. The selected batch has been notified and can join from their Classes page.' : `${sessionLabelTitle} scheduled and participants notified.`) + invitationStatus);
    } catch (error) {
      setMessageKind('error');
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card class-management">
      <div className="class-section-heading">
        <span className="class-heading-icon"><CalendarDays size={25} /></span>
        <div>
          <h2>{role === 'Admin' ? `Schedule and manage ${sessionLabelPlural}` : 'Your classes'}</h2>
          <p>
            {role === 'Admin'
              ? isLive
                ? 'Schedule a batch session with Zoom. A secure join link and cloud recording are created automatically.'
                : `Plan a ${sessionLabel}, choose its batch and share the meeting link.`
              : 'Your assigned classroom sessions and recordings, in one place.'}
          </p>
        </div>
      </div>

      {message && (
        <div className={`class-notice class-notice--${messageKind}`} role={messageKind === 'error' ? 'alert' : 'status'} aria-live="polite">
          <div>
            <strong>{messageKind === 'success' ? `${sessionLabelTitle} created successfully` : `Could not schedule ${sessionLabel}`}</strong>
            <p>{message}</p>
          </div>
          <button type="button" onClick={() => setMessage('')} aria-label="Dismiss notification"><X size={18} /></button>
        </div>
      )}

      {role === 'Admin' && isLive && (
        <div className="live-calendar" aria-label="Live classes calendar">
          <div className="live-calendar-toolbar">
            <div>
              <p className="calendar-eyebrow">Timezone · Asia/Kolkata (UTC+05:30)</p>
              <h3>{monthCursor.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</h3>
            </div>
            <div className="calendar-actions">
              <div className="calendar-nav" aria-label="Change month">
                <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
                <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
              </div>
              <button type="button" className="btn" onClick={() => openLiveForm()}><Plus size={17} /> Create live class</button>
            </div>
          </div>
          <div className="live-calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="live-calendar-grid">
            {calendarDays.map((date, index) => {
              const key = date ? calendarDate(date) : `blank-${index}`;
              const daySessions = date ? visibleSessions.filter((session) => new Date(session.start_at).toLocaleDateString('en-CA', { timeZone: IST }) === key) : [];
              return (
                <button type="button" key={key} className={`live-calendar-day${date ? '' : ' is-empty'}`} disabled={!date} onClick={() => openLiveForm(`${key}T09:00`)}>
                  {date && <time dateTime={key}>{date.getDate()}</time>}
                  {daySessions.slice(0, 2).map((session) => <span className="live-calendar-event" key={session.id}>{session.title}</span>)}
                  {daySessions.length > 2 && <span className="live-calendar-more">+{daySessions.length - 2} more</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {role === 'Admin' && !isLive && (
        <form id={isLive ? 'live-class-form' : undefined} className="auth-form class-schedule-form" onSubmit={scheduleSession}>
          {isLive && <div className="class-form-title"><h3>Schedule a Zoom live class</h3><p>Zoom uses the selected batch mentor's licensed account. You can also specify another licensed host email.</p></div>}
          <label>{sessionLabelTitle} title<input name="title" required maxLength={255} placeholder="e.g. Python fundamentals" /></label>
          <label>Batch<select aria-label="Batch" name="batchId" required disabled={busy || batchesLoading || !batches.length}><option value="">Choose batch</option>{batches.map((batch) => <option value={batch.id} key={batch.id}>{batch.name}</option>)}</select></label>
          <label>Start time<input type="datetime-local" name="startAt" required defaultValue={selectedDate} /><small>Enter India time (IST). The batch sees the same session time.</small></label>
          {isLive ? <>
            <label>Duration<select name="durationMinutes" defaultValue="60"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1 hour 30 minutes</option><option value="120">2 hours</option></select></label>
            <label>Zoom host email <small>(optional)</small><input type="email" name="hostEmail" placeholder="Uses the assigned batch mentor by default" /><small>Must be a licensed Zoom Pro host in your account.</small></label>
          </> : <label>Meeting URL<input type="url" name="meetingUrl" placeholder="https://" /></label>}
          {batchesLoading && <p role="status">Loading batches…</p>}
          {!batchesLoading && !batches.length && <div className="class-prerequisite"><p>Create a batch before scheduling its first class.</p><button type="button" className="btn secondary" onClick={() => go('Batches')}>Manage batches</button></div>}
          <div className="class-form-actions"><p>{isLive ? 'Zoom cloud recording is automatically enabled. Recording is visible only to the related batch after processing.' : 'Batch members will be notified when the class is scheduled.'}</p><span><button className="btn" type="submit" disabled={busy || batchesLoading || !batches.length}><Plus size={17} />{busy ? 'Scheduling…' : isLive ? 'Create Zoom class' : `Schedule ${sessionLabel}`}</button>{isLive && <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Cancel</button>}</span></div>
        </form>
      )}

      {role === 'Admin' && isLive && showForm && (
        <div className="live-class-drawer-backdrop" role="presentation" onMouseDown={closeLiveForm}>
          <aside className="live-class-drawer" role="dialog" aria-modal="true" aria-labelledby="schedule-live-class-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="live-class-drawer-header">
              <div>
                <span className="drawer-icon"><CalendarRange size={25} /></span>
                <h2 id="schedule-live-class-title">Schedule class</h2>
                <p>Create a Zoom class for a selected batch. Their mentor hosts it and enrolled students receive secure access.</p>
              </div>
              <button type="button" className="drawer-close" onClick={closeLiveForm} aria-label="Close schedule class"><X size={24} /></button>
            </div>

            <form key={selectedDate} className="live-class-form" onSubmit={scheduleSession}>
              <input id="live-class-thumbnail" className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickThumbnail} />
              <label htmlFor="live-class-thumbnail" className={`schedule-thumbnail-drop${thumbnailPreview ? ' has-preview' : ''}`} style={thumbnailPreview ? { backgroundImage: `url(${thumbnailPreview})` } : undefined}>
                {thumbnailPreview ? <span className="thumbnail-change">Change class cover</span> : <><ImagePlus size={41} /><strong>Add a class cover</strong><small>PNG, JPG, WebP or GIF · recommended 298 × 180 px</small></>}
              </label>

              <label className="live-field full">Class name <b>*</b><input name="title" required maxLength={255} placeholder="e.g. Full Stack JavaScript — Live Session" /></label>
              <label className="live-field full">Batch <b>*</b><select name="batchId" required value={selectedBatchId} onChange={(event) => setSelectedBatchId(event.target.value)} disabled={busy || batchesLoading || !batches.length}><option value="">Select the student batch</option>{batches.map((batch) => <option value={batch.id} key={batch.id}>{batch.name}{batch.courses?.title ? ` — ${batch.courses.title}` : ''}</option>)}</select></label>
              {selectedBatch && <div className="selected-batch-note"><Video size={18} /><span><strong>{selectedBatch.name}</strong> students will be notified. {selectedBatch.users?.full_name ? `${selectedBatch.users.full_name} is the default Zoom host.` : 'Enter a licensed Zoom host email below.'}</span></div>}

              <label className="live-field full">Time zone <b>*</b><select name="timezone" defaultValue="Asia/Kolkata"><option value="Asia/Kolkata">Asia/Kolkata (UTC+05:30) · India</option></select></label>
              <div className="live-date-grid">
                <label className="live-field">Start date <b>*</b><input type="date" name="startDate" required defaultValue={selectedDate ? selectedDate.slice(0, 10) : ''} /></label>
                <label className="live-field">End date <b>*</b><input type="date" name="endDate" required defaultValue={selectedDate ? selectedDate.slice(0, 10) : ''} /></label>
              </div>
              <div className="live-date-grid">
                <label className="live-field">Start time <b>*</b><input type="time" name="startTime" required defaultValue={selectedDate ? selectedDate.slice(11, 16) : ''} /></label>
                <label className="live-field">End time <b>*</b><input type="time" name="endTime" required /></label>
              </div>
              <label className="live-field full">Class details <b>*</b><textarea name="description" required maxLength={2000} rows={5} placeholder="What will students learn in this class? Add instructions or preparation notes." /></label>
              <label className="live-field full">Tags <span>(optional)</span><div className="tag-input"><Tags size={18} /><input name="tags" maxLength={300} placeholder="e.g. JavaScript, React, project review" /></div><small>Separate tags using commas.</small></label>
              <label className="live-field full">Zoom host email <span>(optional)</span><input type="email" name="hostEmail" placeholder="Uses the selected batch mentor by default" /><small>The host must have an assigned Zoom Pro licence in your organization.</small></label>
              {batchesLoading && <p className="drawer-inline-notice" role="status">Loading student batches…</p>}
              {!batchesLoading && !batches.length && <div className="drawer-inline-notice"><p>Create a batch before scheduling its first class.</p><button type="button" className="btn secondary" onClick={() => { closeLiveForm(); go('Batches'); }}>Manage batches</button></div>}
              {message && messageKind === 'error' && <div className="drawer-inline-notice drawer-inline-notice--error" role="alert"><div><strong>Zoom meeting was not created.</strong><p>{message}</p></div></div>}
              <footer className="live-class-form-footer"><p><Clock3 size={17} /> Zoom cloud recording is enabled automatically. Only the selected batch can join and later watch it in CodeEmy.</p><button className="btn" type="submit" disabled={busy || batchesLoading || !batches.length}><Plus size={17} /> {busy ? 'Creating Zoom class…' : 'Create class & Zoom meeting'}</button></footer>
            </form>
          </aside>
        </div>
      )}

      <div className="class-list-heading"><h3>Scheduled {sessionLabelPlural}</h3><span>{visibleSessions.length} sessions</span></div>
      {loading && <p role="status">Loading {sessionLabelPlural}…</p>}
      {visibleSessions.map((session) => (
        <article className="class-session-card live-session-card" key={session.id}>
          {session.thumbnail_url && <img className="class-session-thumbnail" src={session.thumbnail_url} alt="" />}
          <div className="class-session-content">
            <div className="class-session-title-row">
              <h3>{session.title}</h3>
              <AdminRecordActions entity="classes" record={session} onSaved={refreshSessions} />
            </div>
            <p>{session.batches.name} · {new Date(session.start_at).toLocaleString('en-IN', { timeZone: IST })} IST</p>
            {session.description && <p className="class-session-description">{session.description}</p>}
            {!!session.tags?.length && <div className="class-session-tags">{session.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
            {session.meeting_url?.startsWith('https://') && <a className="btn secondary" href={session.meeting_url} target="_blank" rel="noreferrer"><Video size={17} /> Join class</a>}
            <ClassRecordings classId={session.id} />
          </div>
        </article>
      ))}
      {!loading && !visibleSessions.length && <div className="class-empty"><CalendarDays size={32} /><h3>No {sessionLabelPlural} scheduled yet</h3><p>{role === 'Admin' ? `Your sessions will appear here after you schedule a ${sessionLabel}.` : 'Your academy will share upcoming sessions here.'}</p></div>}
    </section>
  );
}
