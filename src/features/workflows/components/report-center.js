'use client';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
import { csvDocument, saveDownload } from '@/lib/exports';
import { reportScope } from '@/lib/report-scope';
export default function ReportCenter() {
  const {
    role,
    students,
    mentors,
    courses,
    baseRows,
    records: allRecords,
    workflows: allWorkflows,
  } = useWorkspace();
  const { records, workflows } = reportScope(role, allWorkflows, baseRows, allRecords);
  const visibleStudents = role === 'Student' ? students.filter((n) => n === 'Kavin Raj') : students;
  const [type, setType] = useState('Student'),
    [search, setSearch] = useState('');
  const datasets = {
    Student: {
      headers: ['Name', 'Status', 'Batches'],
      rows: visibleStudents.map((name) => [
        name,
        records[name]?.status || 'Active',
        Object.entries(workflows.batches)
          .filter(([, b]) => b.students.includes(name))
          .map(([title]) => title)
          .join('; '),
      ]),
    },
    Course: {
      headers: ['Course', 'Mentor', 'Status', 'Progress'],
      rows: courses.map((c) => [c.title, c.mentor, c.status, c.progress]),
    },
    Batch: {
      headers: ['Batch', 'Course', 'Mentor', ...(role === 'Mentor' ? [] : ['Students'])],
      rows: Object.entries(workflows.batches).map(([name, b]) => [
        name,
        b.course,
        b.mentor,
        ...(role === 'Mentor' ? [] : [b.students.length]),
      ]),
    },
    Mentor: {
      headers: ['Name', 'Status', 'Assigned batches'],
      rows: mentors
        .filter((name) => role === 'Admin' || name === 'Arjun Kumar')
        .map((name) => [
          name,
          records[name]?.status || 'Active',
          Object.values(workflows.batches).filter((b) => b.mentor === name).length,
        ]),
    },
    Attendance: {
      headers: ['Session', 'Student', 'Status'],
      rows: Object.entries(records)
        .filter(([key]) => key.startsWith('attendance:'))
        .flatMap(([key, value]) =>
          Object.entries(value)
            .filter(([name]) => role !== 'Student' || name === 'Kavin Raj')
            .map(([name, status]) => [key.slice(11), name, status]),
        ),
    },
    Assessment: {
      headers: ['Assessment', 'Student', 'Score', 'Total', 'Passed', 'Date'],
      rows: workflows.assessmentResults
        .filter((r) => role !== 'Student' || r.student === 'Kavin Raj')
        .map((r) => [r.title, r.student, r.score, r.total, r.passed, r.date]),
    },
    Project: {
      headers: ['Project', 'Student', 'Revision', 'Decision'],
      rows: workflows.submissions
        .filter((s) => s.kind === 'Projects' && (role !== 'Student' || s.student === 'Kavin Raj'))
        .map((s) => [
          s.title,
          s.student,
          s.revision,
          (workflows.evaluations[s.id] || []).at(-1)?.decision || s.status,
        ]),
    },
    Certificate: {
      headers: ['Course', 'Recipient', 'Number', 'Status', 'Date'],
      rows: Object.entries(workflows.certificates)
        .filter(([, c]) => role !== 'Student' || c.name === 'Kavin Raj')
        .map(([course, c]) => [course, c.name, c.number, c.status, c.date]),
    },
    Career: {
      headers: ['Opportunity', 'Student', 'Status', 'Date'],
      rows: workflows.applications
        .filter((a) => role !== 'Student' || a.student === 'Kavin Raj')
        .map((a) => [a.title, a.student, a.status, a.date]),
    },
  };
  const selected = datasets[type],
    rows = selected.rows.filter((row) =>
      row.join(' ').toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <div className="card">
      <h2>Reports & exports</h2>
      <div className="toolbar lower">
        <select aria-label="Report type" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.keys(datasets)
            .filter((t) => role !== 'Student' || !['Mentor', 'Batch'].includes(t))
            .filter((t) => role !== 'Mentor' || t !== 'Career')
            .map((t) => (
              <option key={t}>{t}</option>
            ))}
        </select>
        <input
          className="input"
          aria-label="Filter report"
          placeholder="Search report records"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          onClick={() =>
            saveDownload(type.toLowerCase() + '-report.csv', csvDocument(selected.headers, rows))
          }
        >
          Export {type} CSV
        </Button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {selected.headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, index) => (
                  <td key={index}>{String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="empty">
          No records for this report. Complete the corresponding workflow to populate it.
        </p>
      )}
      <p>{rows.length} matching records</p>
    </div>
  );
}
