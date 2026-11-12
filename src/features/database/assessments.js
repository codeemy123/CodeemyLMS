'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { AssessmentAccessRequest } from './assessment-access';
export default function DatabaseAssessments() {
  const { role } = useWorkspace();
  const [list, setList] = useState([]),
    [session, setSession] = useState(null),
    [answers, setAnswers] = useState({}),
    [message, setMessage] = useState(''),
    [seconds, setSeconds] = useState(0),
    [busy, setBusy] = useState(false);
  const current = useRef(null),
    answerRef = useRef({}),
    saving = useRef(false);
  const [evaluation, setEvaluation] = useState(null);
  const [reopenRequests, setReopenRequests] = useState([]);
  const [locking, setLocking] = useState(false);
  const lockReason = useRef(null);
  current.current = session;
  answerRef.current = answers;
  async function refresh() {
    try {
      const [data, access] = await Promise.all([
        api('/api/assessments'),
        role === 'Student' ? api('/api/assessment-reopens') : Promise.resolve({ requests: [] }),
      ]);
      setList(data.assessments);
      setReopenRequests(access.requests);
    } catch (e) {
      setMessage(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  async function persist(submit = false, reason = 'submitted') {
    const active = current.current;
    if (!active || active.attempt.status !== 'IN_PROGRESS') return;
    if (submit && !lockReason.current) lockReason.current = reason;
    if (lockReason.current) {
      submit = true;
      reason = lockReason.current;
      setLocking(true);
    }
    if (saving.current) {
      if (!submit) return;
      await new Promise((resolve) => {
        const wait = setInterval(() => {
          if (!saving.current) {
            clearInterval(wait);
            resolve();
          }
        }, 50);
      });
      return persist(submit, reason);
    }
    saving.current = true;
    try {
      const result = await api('/api/assessment-attempts/' + active.attempt.id, {
        method: 'PATCH',
        body: JSON.stringify({
          submit,
          reason,
          answers: Object.entries(answerRef.current).map(([questionId, value]) => ({
            questionId,
            ...value,
          })),
        }),
      });
      setSession((s) => (s ? { ...s, ...result } : s));
      current.current = { ...active, ...result };
      if (result.attempt.status !== 'IN_PROGRESS') {
        lockReason.current = null;
        setLocking(false);
        setMessage('Assessment submitted.');
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        await refresh();
      }
      return result;
    } catch (e) {
      setMessage(e.message);
    } finally {
      saving.current = false;
    }
  }
  useEffect(() => {
    if (session?.attempt.status !== 'IN_PROGRESS') return;
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil(
          (new Date(current.current.deadline).getTime() -
            Date.now() -
            current.current.clockOffset) /
            1000,
        ),
      );
      setSeconds(left);
      if (!left) persist(true, 'timeout');
    }, 1000);
    const save = setInterval(() => persist(), 5000);
    const hidden = () => {
      if (document.hidden) persist(true, 'hidden');
    };
    const fullscreen = () => {
      if (!document.fullscreenElement) persist(true, 'fullscreen');
    };
    const before = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const pageExit = () => {
      if (current.current?.attempt.status === 'IN_PROGRESS')
        fetch('/api/assessment-attempts/' + current.current.attempt.id, {
          method: 'PATCH',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submit: true, reason: 'page_exit' }),
        }).catch(() => {});
    };
    const leave = async (e) => {
      e.preventDefault();
      setMessage('Submitting your assessment before leaving…');
      const result = await persist(true, 'navigation');
      if (result?.attempt.status !== 'IN_PROGRESS' && result?.attempt) e.detail.navigate();
    };
    const blur = () => persist(true, 'focus');
    const size = { width: window.innerWidth, height: window.innerHeight };
    const resize = () => {
      if (
        Math.abs(window.innerWidth - size.width) > 150 ||
        (Math.abs(window.innerHeight - size.height) > 150 &&
          !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName))
      )
        persist(true, 'resize');
    };
    document.addEventListener('visibilitychange', hidden);
    document.addEventListener('fullscreenchange', fullscreen);
    window.addEventListener('beforeunload', before);
    window.addEventListener('pagehide', pageExit);
    window.addEventListener('codeemy-assessment-leave', leave);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', resize);
    return () => {
      clearInterval(timer);
      clearInterval(save);
      document.removeEventListener('visibilitychange', hidden);
      document.removeEventListener('fullscreenchange', fullscreen);
      window.removeEventListener('beforeunload', before);
      window.removeEventListener('pagehide', pageExit);
      window.removeEventListener('codeemy-assessment-leave', leave);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', resize);
    };
  }, [session?.attempt.id, session?.attempt.status]);
  return (
    <section className="card workflow-card">
      <p role="status">{message}</p>
      {evaluation && (
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            try {
              await api('/api/assessment-attempts/' + evaluation.attempt.id + '/evaluation', {
                method: 'POST',
                body: JSON.stringify({
                  marks: evaluation.questions
                    .filter((q) => ['SHORT_ANSWER', 'LONG_ANSWER'].includes(q.question_type))
                    .map((q) => ({ questionId: q.id, score: Number(form.get(q.id)) })),
                }),
              });
              setEvaluation(null);
              await refresh();
            } catch (err) {
              setMessage(err.message);
            }
          }}
        >
          <h2>Written answer evaluation</h2>
          {evaluation.questions
            .filter((q) => ['SHORT_ANSWER', 'LONG_ANSWER'].includes(q.question_type))
            .map((q) => (
              <label key={q.id}>
                {q.question_text}
                <p>
                  {evaluation.attempt.answers.find((a) => a.question_id === q.id)?.answer_text ||
                    'No answer'}
                </p>
                <input
                  name={q.id}
                  type="number"
                  min="0"
                  max={Number(q.marks)}
                  step="0.01"
                  required
                  defaultValue={
                    evaluation.attempt.answers.find((a) => a.question_id === q.id)?.marks_awarded ??
                    0
                  }
                />
              </label>
            ))}
          <button>Save marks</button>
          <button type="button" onClick={() => setEvaluation(null)}>
            Cancel
          </button>
        </form>
      )}
      {session ? (
        <>
          <h2>
            {session.attempt.status === 'IN_PROGRESS'
              ? `Time remaining: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
              : `Status: ${session.attempt.status}`}
          </h2>
          {session.attempt.status !== 'IN_PROGRESS' ? (
            <>
              <p>Score: {session.attempt.score ?? 'Awaiting evaluation'}</p>
              <p>This attempt is closed. Another attempt requires Admin approval.</p>
              <AssessmentAccessRequest
                attemptId={session.attempt.id}
                request={reopenRequests.find((r) => r.attemptId === session.attempt.id)}
                onSaved={refresh}
              />
              <button onClick={() => setSession(null)}>Back to assessments</button>
            </>
          ) : locking ? (
            <div className="assessment-access-box" role="status">
              <h3>Attempt locked</h3>
              <p>Saving your answers and closing this attempt. You cannot continue answering.</p>
              <button
                className="btn"
                onClick={() => persist(true, lockReason.current || 'submitted')}
              >
                Retry submission
              </button>
            </div>
          ) : (
            <>
              <p>
                Your answers save every 5 seconds. Leaving this tab or fullscreen submits the
                attempt. Reloading or re-entering closes this one-time attempt. Another attempt
                requires Admin approval.
              </p>
              {session.questions.map((q, i) => (
                <fieldset key={q.id}>
                  <legend>
                    {i + 1}. {q.question_text} ({q.marks} marks)
                  </legend>
                  {['SHORT_ANSWER', 'LONG_ANSWER'].includes(q.question_type) ? (
                    <textarea
                      aria-label={'Answer ' + (i + 1)}
                      value={answers[q.id]?.answerText || ''}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [q.id]: { answerText: e.target.value } }))
                      }
                    />
                  ) : (
                    q.question_options.map((o) => (
                      <label key={o.id}>
                        <input
                          type={q.question_type === 'MULTIPLE_SELECT' ? 'checkbox' : 'radio'}
                          name={q.id}
                          checked={answers[q.id]?.selectedOptionIds?.includes(o.id) || false}
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              [q.id]: {
                                selectedOptionIds:
                                  q.question_type === 'MULTIPLE_SELECT'
                                    ? e.target.checked
                                      ? [...(a[q.id]?.selectedOptionIds || []), o.id]
                                      : (a[q.id]?.selectedOptionIds || []).filter(
                                          (id) => id !== o.id,
                                        )
                                    : [o.id],
                              },
                            }))
                          }
                        />
                        {o.option_text}
                      </label>
                    ))
                  )}
                </fieldset>
              ))}
              <button onClick={() => persist(true)}>Submit assessment</button>
            </>
          )}
        </>
      ) : (
        <>
          {list.map((a) => {
            const latest = a.assessment_attempts[0];
            const request = reopenRequests.find((r) => r.attemptId === latest?.id);
            const retry = request?.status === 'APPROVED' && !request.used;
            const outside = retry
              ? new Date() < new Date(request.openAt) || new Date() >= new Date(request.closeAt)
              : (a.start_at && new Date() < new Date(a.start_at)) ||
                (a.end_at && new Date() >= new Date(a.end_at));
            return (
              <article key={a.id} className="workflow-card">
                <h2>{a.title}</h2>
                <p>{a.description}</p>
                <p>
                  {a.batches?.name || 'Course assessment'} · {a.duration_minutes} minutes
                </p>
                <p>
                  Available:{' '}
                  {a.start_at
                    ? new Date(a.start_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                    : 'When published'}{' '}
                  →{' '}
                  {a.end_at
                    ? new Date(a.end_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                    : 'No closing date'}{' '}
                  (IST)
                </p>
                {retry && (
                  <p>
                    Admin-approved window: {new Date(request.openAt).toLocaleString()} →{' '}
                    {new Date(request.closeAt).toLocaleString()}
                  </p>
                )}
                {role === 'Student' ? (
                  <>
                    <button
                      disabled={busy || ((!latest || retry) && outside)}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          if ((!latest || retry) && !document.fullscreenElement)
                            await document.documentElement.requestFullscreen();
                          const data = await api('/api/assessments/' + a.id + '/attempt', {
                            method: 'POST',
                            body: JSON.stringify({ reopen: Boolean(retry) }),
                          });
                          const nextAnswers = Object.fromEntries(
                            data.answers.map((v) => [
                              v.question_id,
                              {
                                answerText: v.answer_text || '',
                                selectedOptionIds: v.selected_option_ids,
                              },
                            ]),
                          );
                          setAnswers(nextAnswers);
                          setSeconds(
                            Math.max(
                              0,
                              Math.ceil(
                                (new Date(data.deadline).getTime() -
                                  new Date(data.serverTime).getTime()) /
                                  1000,
                              ),
                            ),
                          );
                          lockReason.current = null;
                          setLocking(false);
                          setSession({
                            ...data,
                            clockOffset: new Date(data.serverTime).getTime() - Date.now(),
                          });
                        } catch (e) {
                          setMessage(e.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {retry
                        ? 'Start approved attempt'
                        : latest
                          ? latest.status === 'IN_PROGRESS'
                            ? 'Close interrupted attempt'
                            : 'View result'
                          : outside
                            ? 'Outside access window'
                            : 'Start assessment'}
                    </button>
                    {latest && latest.status !== 'IN_PROGRESS' && (
                      <AssessmentAccessRequest
                        attemptId={latest.id}
                        request={request}
                        onSaved={refresh}
                      />
                    )}
                  </>
                ) : (
                  <div>
                    <p>{a.assessment_attempts.length} attempts</p>
                    {a.assessment_attempts
                      .filter((t) => t.status !== 'IN_PROGRESS')
                      .map((t) => (
                        <p key={t.id}>
                          Score: {t.score ?? 'Pending'} ? {t.status}{' '}
                          <button
                            onClick={async () => {
                              try {
                                setEvaluation(
                                  await api('/api/assessment-attempts/' + t.id + '/evaluation'),
                                );
                              } catch (e) {
                                setMessage(e.message);
                              }
                            }}
                          >
                            Evaluate written answers
                          </button>
                        </p>
                      ))}
                  </div>
                )}
              </article>
            );
          })}
          {!list.length && <p>No assigned assessments yet.</p>}
        </>
      )}
    </section>
  );
}
