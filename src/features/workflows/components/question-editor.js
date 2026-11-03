'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function QuestionEditor({ bank = false }) {
  const { detail, workflows, setWorkflows, notify } = useWorkspace();
  const title = detail?.title || 'Question bank';
  const config = workflows.assessmentConfigs[title] || {
    duration: 45,
    pass: 60,
    attempts: 2,
    questions: workflows.bank,
  };
  const questions = bank ? workflows.bank : config.questions;
  const [editing, setEditing] = useState(null),
    [type, setType] = useState('single');
  function saveQuestions(next) {
    if (!next.length) {
      notify('Keep at least one question');
      return;
    }
    setWorkflows((w) =>
      bank
        ? { ...w, bank: next }
        : {
            ...w,
            assessmentConfigs: { ...w.assessmentConfigs, [title]: { ...config, questions: next } },
          },
    );
  }
  return (
    <div className="card">
      <h2>{bank ? 'Question bank editor' : 'Assessment configuration & questions'}</h2>
      {!bank && (
        <form
          key={JSON.stringify(config)}
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            setWorkflows((w) => ({
              ...w,
              assessmentConfigs: {
                ...w.assessmentConfigs,
                [title]: {
                  ...config,
                  duration: Number(d.get('duration')),
                  pass: Number(d.get('pass')),
                  attempts: Number(d.get('attempts')),
                },
              },
            }));
            notify('Assessment configuration saved');
          }}
        >
          <div className="form-grid">
            <label className="field">
              Duration (minutes)
              <input
                className="input"
                name="duration"
                type="number"
                min="1"
                max="180"
                required
                defaultValue={config.duration}
              />
            </label>
            <label className="field">
              Pass percentage
              <input
                className="input"
                name="pass"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={config.pass}
              />
            </label>
            <label className="field">
              Allowed attempts
              <input
                className="input"
                name="attempts"
                type="number"
                min="1"
                max="10"
                required
                defaultValue={config.attempts}
              />
            </label>
          </div>
          <div className="form-actions">
            <Button type="submit">Save assessment settings</Button>
            <Button
              secondary
              onClick={() => {
                saveQuestions(structuredClone(workflows.bank));
                notify('Questions copied from bank');
              }}
            >
              Use question bank
            </Button>
          </div>
        </form>
      )}
      {questions.map((q, i) => (
        <div className="task-row" key={i}>
          <div className="task-info">
            <strong>
              {i + 1}. {q[0]}
            </strong>
            <p>
              {q[3] || 'single'} · {q[4] || 1} marks · {q[1].length} options
            </p>
          </div>
          <Button
            secondary
            onClick={() => {
              setEditing(i);
              setType(q[3] || 'single');
            }}
          >
            Edit question {i + 1}
          </Button>
          <Button
            secondary
            onClick={() => saveQuestions(questions.filter((_, index) => index !== i))}
          >
            Delete question {i + 1}
          </Button>
        </div>
      ))}
      <form
        key={editing === null ? 'new' : editing}
        className="lower"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget),
            options =
              type === 'text'
                ? []
                : String(d.get('options'))
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean);
          let correct =
            type === 'text'
              ? d.get('answer')
              : type === 'multiple'
                ? String(d.get('answer'))
                    .split(',')
                    .filter((s) => s.trim())
                    .map((s) => Number(s.trim()) - 1)
                : Number(d.get('answer')) - 1;
          if (
            type !== 'text' &&
            (options.length < 2 ||
              (Array.isArray(correct) &&
                (!correct.length || new Set(correct).size !== correct.length)) ||
              (Array.isArray(correct) ? correct : [correct]).some(
                (i) => !Number.isInteger(i) || i < 0 || i >= options.length,
              ))
          ) {
            notify('Enter at least two options and valid correct option numbers');
            return;
          }
          const q = [d.get('prompt'), options, correct, type, Number(d.get('marks'))];
          saveQuestions(
            editing === null
              ? [...questions, q]
              : questions.map((old, i) => (i === editing ? q : old)),
          );
          setEditing(null);
          e.currentTarget.reset();
          notify('Question saved');
        }}
      >
        <h3>{editing === null ? 'Add question' : 'Edit selected question'}</h3>
        <label className="field">
          Question type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="single">Single-choice MCQ</option>
            <option value="multiple">Multiple-choice MCQ</option>
            <option value="text">Short answer</option>
          </select>
        </label>
        <label className="field">
          Question prompt
          <textarea
            name="prompt"
            required
            defaultValue={editing !== null ? questions[editing]?.[0] : ''}
          />
        </label>
        {type !== 'text' && (
          <label className="field">
            Options · one per line
            <textarea
              name="options"
              required
              defaultValue={editing !== null ? questions[editing]?.[1].join('\n') : ''}
            />
          </label>
        )}
        <label className="field">
          {type === 'text'
            ? 'Expected answer'
            : type === 'multiple'
              ? 'Correct option numbers · comma separated'
              : 'Correct option number'}
          <input
            className="input"
            name="answer"
            required
            defaultValue={
              editing !== null
                ? type === 'text'
                  ? questions[editing]?.[2]
                  : Array.isArray(questions[editing]?.[2])
                    ? questions[editing][2].map((i) => i + 1).join(',')
                    : Number(questions[editing]?.[2]) + 1
                : ''
            }
          />
        </label>
        <label className="field">
          Question marks
          <input
            className="input"
            name="marks"
            type="number"
            min="1"
            max="100"
            required
            defaultValue={editing !== null ? questions[editing]?.[4] || 1 : 1}
          />
        </label>
        <div className="form-actions">
          <Button type="submit">Save question</Button>
          {editing !== null && (
            <Button secondary onClick={() => setEditing(null)}>
              Cancel edit
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
