'use client';
import { useState } from 'react';
import { Button, Badge } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { gradeAssessment } from '@/lib/assessment';
import QuestionEditor from '@/features/workflows/components/question-editor';
import { reportScope } from '@/lib/report-scope';
import { studentBatches } from '@/lib/leaderboard';
export default function AssessmentScreen() {
  const [batchChoice, setBatchChoice] = useState('');
  const {
    role,
    detail,
    workflows,
    questions,
    question,
    setQuestion,
    answers,
    setAnswers,
    review,
    setReview,
    attempt,
    setAttempt,
    result,
    setResult,
    seconds,
    setModal,
    baseRows,
    startAssessment,
    assessmentOutcome,
    startingAssessment,
  } = useWorkspace();
  const config = workflows.assessmentConfigs[detail.title] || {
    duration: 45,
    pass: 60,
    attempts: 2,
  };
  const outcome = assessmentOutcome || gradeAssessment(questions, answers, config.pass);
  const batches = studentBatches(workflows).filter(([, b]) => b.course === detail.row?.[1]);
  const batch =
    batches.find(([name]) => name === batchChoice)?.[0] ||
    (batches.length === 1 ? batches[0][0] : '');
  const previous = reportScope(role, workflows, baseRows, {}).workflows.assessmentResults.filter(
    (r) => r.title === detail.title && (role !== 'Student' || !r.batch || r.batch === batch),
  );
  if (role !== 'Student')
    return (
      <>
        <QuestionEditor />
        <div className="card lower">
          <h2>Assessment results</h2>
          {previous.length ? (
            previous.map((r) => (
              <div className="task-row" key={r.id}>
                {r.student} · {r.score}/{r.total} · {r.passed ? 'Passed' : 'Not passed'} ·{' '}
                {new Date(r.date).toLocaleString()}
                {r.message && <span>{r.message}</span>}
              </div>
            ))
          ) : (
            <p>No attempts submitted yet.</p>
          )}
        </div>
      </>
    );
  if (result)
    return (
      <div className="card certificate">
        <h2>Assessment complete</h2>
        {assessmentOutcome?.message && <p role="status">{assessmentOutcome.message}</p>}
        <h1>
          {outcome.score} / {outcome.total}
        </h1>
        <p>
          {outcome.percent}% · {outcome.passed ? 'Passed' : 'Keep practicing'}
        </p>
        {questions.map((q, i) => (
          <div className="activity" key={i}>
            {q[0]}
            <span>
              Your answer:{' '}
              {q[3] === 'text'
                ? answers[i] || 'Unanswered'
                : Array.isArray(answers[i])
                  ? answers[i].map((index) => q[1][index]).join(', ')
                  : q[1][answers[i]] || 'Unanswered'}
            </span>
            <span>
              Correct:{' '}
              {q[3] === 'text'
                ? q[2]
                : Array.isArray(q[2])
                  ? q[2].map((index) => q[1][index]).join(', ')
                  : q[1][q[2]]}
            </span>
          </div>
        ))}
        <Button
          onClick={() => {
            setResult(false);
            setAttempt(false);
          }}
        >
          Back to instructions
        </Button>
      </div>
    );
  if (attempt) {
    const q = questions[Math.min(question, questions.length - 1)];
    return (
      <div className="detail-grid">
        <div className="card">
          <div className="section-head">
            <Badge>
              Question {question + 1} / {questions.length}
            </Badge>
            <span>
              Time remaining: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </span>
          </div>
          <h2>{q[0]}</h2>
          {q[3] === 'text' ? (
            <label className="field">
              Your answer
              <textarea
                value={answers[question] || ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [question]: e.target.value }))}
              />
            </label>
          ) : (
            q[1].map((option, i) => (
              <label className="choice" key={i}>
                <input
                  type={q[3] === 'multiple' ? 'checkbox' : 'radio'}
                  name={'q' + question}
                  checked={
                    q[3] === 'multiple'
                      ? (answers[question] || []).includes(i)
                      : answers[question] === i
                  }
                  onChange={() =>
                    setAnswers((a) => ({
                      ...a,
                      [question]:
                        q[3] === 'multiple'
                          ? (a[question] || []).includes(i)
                            ? a[question].filter((n) => n !== i)
                            : [...(a[question] || []), i]
                          : i,
                    }))
                  }
                />{' '}
                {option}
              </label>
            ))
          )}
          <div className="form-actions">
            <Button secondary onClick={() => setQuestion((i) => Math.max(0, i - 1))}>
              Previous
            </Button>
            <Button
              secondary
              onClick={() =>
                setReview((v) =>
                  v.includes(question) ? v.filter((i) => i !== question) : [...v, question],
                )
              }
            >
              Mark for review
            </Button>
            <Button onClick={() => setQuestion((i) => Math.min(questions.length - 1, i + 1))}>
              Next
            </Button>
          </div>
        </div>
        <div className="card">
          <h2>Question navigation</h2>
          <div className="form-actions">
            {questions.map((q, i) => (
              <button
                className="btn"
                key={i}
                style={{
                  background: review.includes(i)
                    ? '#b68c38'
                    : answers[i] !== undefined
                      ? '#25634f'
                      : '#82908a',
                }}
                onClick={() => setQuestion(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p>Green: answered · Gold: review</p>
          <Button onClick={() => setModal('Submit assessment')}>Submit assessment</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="card detail-copy">
      <h2>{detail.title}</h2>
      <p>
        Duration: {config.duration} minutes · Questions: {questions.length} · Pass score:{' '}
        {config.pass}% · Attempts: {config.attempts}
      </p>
      <ul>
        <li>
          Read each question carefully. Multiple-choice questions can have more than one correct
          option.
        </li>
        <li>You can move between questions and mark items for review.</li>
        <li>
          The timer starts when you click Start assessment. Time expiry automatically submits and
          locks your answers.
        </li>
        <li>
          Fullscreen is required. Switching tabs, losing window focus, leaving fullscreen, resizing
          the window or leaving this page ends the attempt immediately.
        </li>
        <li>
          Refreshing or closing the page ends the attempt. Unanswered questions earn zero marks.
        </li>
      </ul>
      {batches.length > 1 && (
        <label className="field">
          Assessment batch
          <select
            aria-label="Assessment batch"
            value={batch}
            onChange={(e) => setBatchChoice(e.target.value)}
          >
            <option value="">Select your batch</option>
            {batches.map(([name]) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
      <Button
        disabled={
          startingAssessment ||
          previous.filter((r) => r.student === 'Kavin Raj').length >= config.attempts
        }
        onClick={() => startAssessment(batch)}
      >
        Start assessment
      </Button>
      {previous.filter((r) => r.student === 'Kavin Raj').length >= config.attempts && (
        <p>Attempt limit reached. Contact your administrator.</p>
      )}
      <h3 style={{ marginTop: 25 }}>Your attempt history</h3>
      {previous
        .filter((r) => r.student === 'Kavin Raj')
        .map((r) => (
          <div className="activity" key={r.id}>
            {r.message && <span>{r.message}</span>}
            {r.score}/{r.total} · {r.passed ? 'Passed' : 'Not passed'} ·{' '}
            {new Date(r.date).toLocaleString()}
          </div>
        ))}
    </div>
  );
}
