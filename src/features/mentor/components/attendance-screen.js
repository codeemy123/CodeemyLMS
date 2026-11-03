'use client';
import { useState } from 'react';

import { Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function AttendanceScreen() {
  const { notify, role, courses, students, records, setRecords, baseRows, workflows } =
    useWorkspace();
  const batches = Object.fromEntries(
    Object.entries(workflows.batches).filter(
      ([, b]) => role === 'Admin' || b.mentor === 'Arjun Kumar',
    ),
  );
  const [course, setCourse] = useState(courses[0]?.title || '');
  const [batch, setBatch] = useState(
    Object.entries(batches).find(([, b]) => b.course === courses[0]?.title)?.[0] || '',
  );
  const [date, setDate] = useState('2026-09-30');
  const [classTitle, setClassTitle] = useState(
    baseRows.Classes.find((row) => row[1] === courses[0]?.title)?.[0] || '',
  );
  const activeCourse = courses.some((c) => c.title === course) ? course : courses[0]?.title || '';
  const activeClass = baseRows.Classes.some(
    (row) => row[0] === classTitle && row[1] === activeCourse,
  )
    ? classTitle
    : baseRows.Classes.find((row) => row[1] === activeCourse)?.[0] || '';
  const activeBatch =
    batches[batch]?.course === activeCourse
      ? batch
      : Object.entries(batches).find(([, b]) => b.course === activeCourse)?.[0] || '';
  const key = `attendance:${activeCourse}:${activeBatch}:${date}:${activeClass}`;
  const selections = records[key] || {};
  const roster = batches[activeBatch]?.students || [];
  return (
    <div className="card">
      <div className="toolbar">
        <select
          aria-label="Course"
          value={activeCourse}
          onChange={(e) => {
            setCourse(e.target.value);
            setClassTitle(baseRows.Classes.find((row) => row[1] === e.target.value)?.[0] || '');
            setBatch(
              Object.entries(batches).find(([, b]) => b.course === e.target.value)?.[0] || '',
            );
          }}
        >
          {courses.map((c) => (
            <option key={c.title}>{c.title}</option>
          ))}
        </select>
        <select aria-label="Batch" value={activeBatch} onChange={(e) => setBatch(e.target.value)}>
          {Object.entries(batches)
            .filter(([, b]) => b.course === activeCourse)
            .map(([name]) => (
              <option key={name}>{name}</option>
            ))}
        </select>
        <select
          aria-label="Class session"
          value={activeClass}
          onChange={(e) => setClassTitle(e.target.value)}
        >
          {baseRows.Classes.filter((row) => row[1] === activeCourse).map((row) => (
            <option key={row[0]}>{row[0]}</option>
          ))}
        </select>
        <input
          aria-label="Class date"
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <h2>Class attendance · {activeClass || 'No assigned session'}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Attendance</th>
              <th>Overall</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((n) => (
              <tr key={n}>
                <td>{n}</td>
                <td>
                  <select
                    aria-label={n + ' attendance'}
                    value={selections[n] || 'Not marked'}
                    onChange={(e) =>
                      setRecords((list) => ({
                        ...list,
                        [key]: { ...list[key], [n]: e.target.value },
                      }))
                    }
                  >
                    {['Not marked', 'Present', 'Absent', 'Late', 'Excused'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>{selections[n] || 'Not marked'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-actions">
        <Button
          disabled={!activeBatch || !activeClass || !roster.length || !date}
          onClick={() => {
            setRecords((list) => ({
              ...list,
              [key]: Object.fromEntries(
                roster.map((name) => [name, selections[name] || 'Not marked']),
              ),
            }));
            notify('Attendance saved in this browser demo');
          }}
        >
          Save attendance
        </Button>
      </div>
    </div>
  );
}
