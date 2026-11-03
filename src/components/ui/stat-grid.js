'use client';
import { BookOpen, ClipboardList, ChartNoAxesCombined, Award } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
export default function StatGrid({ items }) {
  const { stats } = useWorkspace();
  return (
    <div className="stats">
      {items.map(([label, value, note], i) => (
        <div className={`card metric-card metric-${i}`} key={label}>
          <div className="stat-top">
            {label}
            <span className="stat-icon">
              {
                [
                  <BookOpen size={17} />,
                  <ChartNoAxesCombined size={17} />,
                  <ClipboardList size={17} />,
                  <Award size={17} />,
                ][i % 4]
              }
            </span>
          </div>
          <div className="stat-number">{value}</div>
          <div className="stat-note">
            <b>{note}</b> this month
          </div>
        </div>
      ))}
    </div>
  );
}
