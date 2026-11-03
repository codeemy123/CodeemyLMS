'use client';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import CourseCard from './course-card';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function CourseList() {
  const { role, tab, setTab, setModal, courses } = useWorkspace();
  return (
    <>
      <div className="tabs">
        {['All', 'Active', 'Completed'].map((status) => (
          <button
            key={status}
            className={tab === status ? 'selected' : ''}
            onClick={() => setTab(status)}
          >
            {status}
          </button>
        ))}
      </div>
      {role !== 'Student' && (
        <div className="toolbar">
          <Button onClick={() => setModal('Create course')}>
            <Plus size={15} />
            Create course
          </Button>
        </div>
      )}
      <div className="courses">
        {courses
          .filter((course) => tab === 'All' || course.status === tab)
          .map((course) => (
            <CourseCard key={course.title} c={course} />
          ))}
      </div>
    </>
  );
}
