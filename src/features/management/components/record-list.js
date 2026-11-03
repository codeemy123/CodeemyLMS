'use client';

import { Search, ChevronRight, Plus } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function RecordList() {
  const {
    role,
    page,
    search,
    setSearch,
    filter,
    setFilter,
    current,
    setCurrent,
    setModal,
    records,
    rows,
    open,
  } = useWorkspace();
  const all = [...rows];
  const singular =
    page === 'Batches' ? 'Batch' : page === 'Classes' ? 'Class' : page.replace(/s$/, '');
  let filtered = all.filter(
    (r) =>
      r.join(' ').toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'All' || r.includes(filter)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 6));
  const visible = filtered.slice((Math.min(current, pages) - 1) * 6, Math.min(current, pages) * 6);
  return (
    <>
      <div className="toolbar">
        <input
          className="input"
          aria-label={'Search ' + page}
          placeholder={'Search ' + page.toLowerCase() + '...'}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrent(1);
          }}
        />
        <select
          aria-label="Filter status"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setCurrent(1);
          }}
        >
          {['All', ...new Set(rows.map((r) => r[3]))].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {role !== 'Student' &&
          page !== 'Audit Log' &&
          (page !== 'Classes' || role === 'Admin') &&
          !(role === 'Mentor' && page === 'Students') && (
            <Button onClick={() => setModal('Create ' + singular)}>
              <Plus size={14} />
              Create {singular}
            </Button>
          )}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  page === 'Students' || page === 'Mentors' ? 'Name' : 'Title',
                  'Course / category',
                  'Date / batch',
                  'Status',
                  'Details',
                  'Action',
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r[0]}>
                  <td className="table-name">{r[0]}</td>
                  <td>{r[1]}</td>
                  <td>{r[2]}</td>
                  <td>
                    <Badge>{r[3]}</Badge>
                  </td>
                  <td>{r[4]}</td>
                  <td>
                    <button className="text-link" onClick={() => open(r)}>
                      View <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <div className="empty">
            <Search size={28} />
            <h3>No results found</h3>
            <p>Try another search or reset your filters.</p>
            <Button
              secondary
              onClick={() => {
                setSearch('');
                setFilter('All');
              }}
            >
              Reset filters
            </Button>
          </div>
        )}
        <div className="pagination">
          <span>
            {!(role === 'Mentor' && page === 'Students') && `${filtered.length} records · `}Page{' '}
            {Math.min(current, pages)} of {pages}
          </span>
          <div>
            <Button secondary onClick={() => setCurrent((c) => Math.max(1, c - 1))}>
              Previous
            </Button>{' '}
            <Button secondary onClick={() => setCurrent((c) => Math.min(pages, c + 1))}>
              Next
            </Button>
          </div>
        </div>
      </div>
      {page === 'Career' && (
        <div className="card lower">
          <h2>Your career roadmap</h2>
          <div className="task-row">
            01 · Complete your course → 02 · Build your portfolio → 03 · Prepare for interviews → 04
            · Apply for opportunities
          </div>
          <p>Portfolio readiness: 68% · Interview preparation: 2 / 5 modules</p>
        </div>
      )}
    </>
  );
}
