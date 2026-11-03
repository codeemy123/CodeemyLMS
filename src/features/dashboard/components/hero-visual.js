'use client';
import { ArrowUpRight, BookOpen, Sparkles } from 'lucide-react';
import { useWorkspace } from '@/features/workspace/context/workspace-context';

export default function HeroVisual() {
  const { role, courses } = useWorkspace();
  const value = Math.round(
    courses.reduce((sum, c) => sum + c.progress, 0) / Math.max(1, courses.length),
  );
  const label = role === 'Student' ? 'Overall progress' : 'Course completion';
  return (
    <div className="hero-visual" aria-label={`${label}: ${value}%`}>
      <div className="hero-orbit" aria-hidden="true" />
      <div className="momentum-card">
        <div className="momentum-title">
          <span className="momentum-icon">
            <Sparkles size={15} />
          </span>{' '}
          A little better, every day <ArrowUpRight size={15} />
        </div>
        <div className="momentum-ring" style={{ '--completion': `${value}%` }}>
          <div>
            <strong>
              {value}
              <small>%</small>
            </strong>
            <span>{label}</span>
          </div>
        </div>
        <div className="momentum-foot">
          <span className="momentum-dot" /> Your next milestone is closer
        </div>
      </div>
      <div className="hero-note">
        <span>
          <BookOpen size={19} />
        </span>
        <div>
          <strong>Learning that moves you</strong>
          <small>One lesson. One step forward.</small>
        </div>
      </div>
    </div>
  );
}
