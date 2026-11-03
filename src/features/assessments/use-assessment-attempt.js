'use client';
import { useEffect, useRef, useState } from 'react';
import { gradeAssessment } from '@/lib/assessment';
import { studentBatches } from '@/lib/leaderboard';

const journalKey = 'codeemy-assessment-attempt';
const reasons = {
  submitted: 'Assessment submitted.',
  timeout: 'Time expired. Your answers were automatically submitted.',
  navigation: 'You left the assessment. This attempt has ended.',
  hidden: 'You switched tabs or minimised the assessment. This attempt has ended.',
  focus: 'The assessment window lost focus. This attempt has ended.',
  fullscreen: 'You exited fullscreen. This attempt has ended.',
  resize: 'The assessment window size changed. This attempt has ended.',
  interrupted: 'The assessment was refreshed or closed. This attempt has ended.',
};
function storeResult(record) {
  // Persist synchronously as React effects may not run during refresh/tab close.
  const cached = JSON.parse(localStorage.getItem('codeemy-demo-v3') || 'null');
  if (!cached?.workflows) return;
  cached.workflows.assessmentResults = [
    ...(cached.workflows.assessmentResults || []).filter((r) => r.id !== record.id),
    record,
  ];
  localStorage.setItem('codeemy-demo-v3', JSON.stringify(cached));
}
export default function useAssessmentAttempt({
  pathname,
  role,
  detail,
  workflows,
  setWorkflows,
  demoLoaded,
  setModal,
  notify,
}) {
  const [question, setQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState([]);
  const [attempt, setAttempt] = useState(false);
  const [result, setResult] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [completed, setCompleted] = useState(null);
  const [starting, setStarting] = useState(false);
  const active = useRef(null);
  const startingRef = useRef(false);
  const route = useRef(pathname);
  route.current = pathname;
  function persist(session) {
    try {
      sessionStorage.setItem(journalKey, JSON.stringify(session));
    } catch {
      notify('Browser storage is unavailable. Keep this assessment open.');
    }
  }
  function publish(record) {
    try {
      storeResult(record);
    } catch {
      notify('Could not persist this attempt. Browser storage is unavailable.');
    }
    setWorkflows((w) => ({
      ...w,
      assessmentResults: [...w.assessmentResults.filter((r) => r.id !== record.id), record],
    }));
  }
  function finish(reason = 'submitted') {
    const session = active.current;
    if (!session) return;
    active.current = null;
    const finalReason = Date.now() >= session.deadline ? 'timeout' : reason;
    const record = {
      id: session.id,
      title: session.title,
      course: session.course,
      batch: session.batch,
      student: 'Kavin Raj',
      ...gradeAssessment(session.questions, session.answers, session.pass),
      date: new Date().toISOString(),
      startedAt: session.startedAt,
      deadline: session.deadline,
      reason: finalReason,
      message: reasons[finalReason],
      answers: session.answers,
      questions: session.questions,
    };
    persist({ ...session, completed: record });
    publish(record);
    setCompleted(record);
    setAnswers(record.answers);
    setResult(true);
    setAttempt(false);
    setModal(null);
    if (finalReason === 'timeout') setSeconds(0);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (!demoLoaded) return;
    try {
      const session = JSON.parse(sessionStorage.getItem(journalKey) || 'null');
      if (!session) return;
      if (session.completed) {
        if (!workflows.assessmentResults.some((r) => r.id === session.id))
          publish(session.completed);
        return;
      }
      active.current = session;
      finishRef.current('interrupted');
    } catch {
      /* Ignore malformed local preview journals. */
    }
  }, [demoLoaded]);
  useEffect(() => {
    if (active.current && active.current.pathname !== pathname) finishRef.current('navigation');
  }, [pathname]);
  useEffect(() => {
    if (!attempt) return;
    const tick = () => {
      const session = active.current;
      if (!session) return;
      const remaining = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) finishRef.current('timeout');
    };
    const hidden = () => {
      if (document.hidden) finishRef.current('hidden');
    };
    const blur = () => finishRef.current('focus');
    const fullscreen = () => {
      if (!document.fullscreenElement) finishRef.current('fullscreen');
    };
    const leave = () => finishRef.current('interrupted');
    const resized = () => {
      const s = active.current;
      if (
        s &&
        (Math.abs(window.innerWidth - s.width) > 80 || Math.abs(window.innerHeight - s.height) > 80)
      )
        finishRef.current('resize');
    };
    const click = (e) => {
      const link = e.target.closest?.('a[href]');
      if (link && new URL(link.href, location.href).href !== location.href)
        finishRef.current('navigation');
    };
    const id = setInterval(tick, 250);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', blur);
    document.addEventListener('fullscreenchange', fullscreen);
    window.addEventListener('resize', resized);
    window.addEventListener('pagehide', leave);
    window.addEventListener('beforeunload', leave);
    document.addEventListener('click', click, true);
    tick();
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', blur);
      document.removeEventListener('fullscreenchange', fullscreen);
      window.removeEventListener('resize', resized);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('beforeunload', leave);
      document.removeEventListener('click', click, true);
    };
  }, [attempt]);
  async function startAssessment(batchChoice) {
    if (startingRef.current || active.current || !demoLoaded || role !== 'Student') return;
    const config = workflows.assessmentConfigs[detail.title] || {
      duration: 45,
      pass: 60,
      attempts: 2,
    };
    const batches = studentBatches(workflows).filter(([, b]) => b.course === detail.row?.[1]);
    const batch =
      batches.find(([name]) => name === batchChoice)?.[0] ||
      (batches.length === 1 ? batches[0][0] : '');
    if (!batch) {
      notify('Select your assigned batch before starting the assessment.');
      return;
    }
    if (
      workflows.assessmentResults.filter(
        (r) =>
          r.student === 'Kavin Raj' && r.title === detail.title && (!r.batch || r.batch === batch),
      ).length >= config.attempts
    ) {
      notify('Attempt limit reached');
      return;
    }
    if (!document.fullscreenEnabled) {
      notify('Use a browser that supports fullscreen to start this assessment.');
      return;
    }
    startingRef.current = true;
    setStarting(true);
    const startPath = pathname;
    try {
      await document.documentElement.requestFullscreen();
      if (route.current !== startPath) {
        await document.exitFullscreen();
        return;
      }
      const startedAt = Date.now();
      const session = {
        id: crypto.randomUUID(),
        title: detail.title,
        course: detail.row?.[1],
        batch,
        pathname,
        startedAt,
        deadline: startedAt + config.duration * 60000,
        pass: config.pass,
        questions: structuredClone(config.questions || workflows.bank),
        answers: {},
        width: window.innerWidth,
        height: window.innerHeight,
      };
      persist(session);
      active.current = session;
      setCompleted(null);
      setResult(false);
      setAnswers({});
      setReview([]);
      setQuestion(0);
      setSeconds(config.duration * 60);
      setAttempt(true);
    } catch {
      notify('Allow fullscreen to start the assessment.');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }
  function updateAnswers(next) {
    const session = active.current;
    if (!session) return;
    if (Date.now() >= session.deadline) {
      finishRef.current('timeout');
      return;
    }
    const value = typeof next === 'function' ? next(session.answers) : next;
    session.answers = value;
    persist(session);
    setAnswers(value);
  }
  return {
    question,
    setQuestion,
    answers,
    setAnswers: updateAnswers,
    review,
    setReview,
    attempt,
    setAttempt,
    result,
    setResult,
    seconds,
    setSeconds,
    startAssessment,
    finishAssessment: finish,
    assessmentOutcome: completed,
    startingAssessment: starting,
    attemptQuestions: active.current?.questions || completed?.questions,
  };
}
