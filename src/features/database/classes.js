'use client';

import AdminRecordActions from '@/features/management/components/admin-record-editor';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ClassRecordings from './class-recordings';
import { api } from './api';

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
  const [showForm, setShowForm] = useState(!isLive);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState('');

  const refreshSessions = async () => setSessions((await api('/api/class-sessions')).sessions);

  useEffect(() => {
    if (role !== 'Admin') return;
    api('/api/batches')
      .then((data) => setBatches(data.batches))
      .catch((error) => setMessage(error.message))
      .finally(() => setBatchesLoading(false));
  }, [role]);

  useEffect(() => {
    refreshSessions().catch((error) => setMessage(error.message)).finally(() => setLoading(false));
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
    setShowForm(true);
    requestAnimationFrame(() => document.getElementById('live-class-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const scheduleSession = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      data.startAt = new Date(data.startAt).toISOString();
      if (isLive) data.createZoom = 'true';
      await api('/api/class-sessions', { method: 'POST', body: JSON.stringify(data) });
      await refreshSessions();
      form.reset();
      setShowForm(false);
      setSelectedDate('');
      setMessage(isLive ? 'Zoom class scheduled and the batch has been notified.' : `${sessionLabelTitle} scheduled and participants notified.`);
    } catch (error) {
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

      {role === 'Admin' && (!isLive || showForm) && (
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

      {message && <p className="class-notice" role="status">{message}</p>}
      <div className="class-list-heading"><h3>Scheduled {sessionLabelPlural}</h3><span>{visibleSessions.length} sessions</span></div>
      {loading && <p role="status">Loading {sessionLabelPlural}…</p>}
      {visibleSessions.map((session) => <article className="class-session-card" key={session.id}><div><h3>{session.title}</h3><AdminRecordActions entity="classes" record={session} onSaved={refreshSessions} /><p>{session.batches.name} · {new Date(session.start_at).toLocaleString('en-IN', { timeZone: IST })} IST</p>{session.meeting_url?.startsWith('https://') && <a className="btn secondary" href={session.meeting_url} target="_blank" rel="noreferrer"><Video size={17} /> Join class</a>}<ClassRecordings classId={session.id} /></div></article>)}
      {!loading && !visibleSessions.length && <div className="class-empty"><CalendarDays size={32} /><h3>No {sessionLabelPlural} scheduled yet</h3><p>{role === 'Admin' ? `Your sessions will appear here after you schedule a ${sessionLabel}.` : 'Your academy will share upcoming sessions here.'}</p></div>}
    </section>
  );
}
