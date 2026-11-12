'use client';
import { useState } from 'react';
import AdminCollection from './admin-collection';
export default function AdminContent({ questions = false }) {
  const [entity, setEntity] = useState(questions ? 'questions' : 'modules');
  const tabs = questions
    ? [
        ['questions', 'Questions'],
        ['options', 'Answer options'],
      ]
    : [
        ['modules', 'Modules'],
        ['lessons', 'Lessons'],
        ['resources', 'Resources'],
      ];
  return (
    <>
      <div className="tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={entity === key ? 'selected' : ''}
            onClick={() => setEntity(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <AdminCollection key={entity} entity={entity} />
    </>
  );
}
