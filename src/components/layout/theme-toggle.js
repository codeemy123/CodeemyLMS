'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    let saved = 'light';
    try {
      saved = localStorage.getItem('codeemy-workspace-theme') === 'dark' ? 'dark' : 'light';
    } catch {}
    setTheme(saved);
    document.documentElement.dataset.workspaceTheme = saved;
    return () => {
      delete document.documentElement.dataset.workspaceTheme;
    };
  }, []);
  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.workspaceTheme = next;
    try {
      localStorage.setItem('codeemy-workspace-theme', next);
    } catch {}
  }
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
      title={theme === 'light' ? 'Dark theme' : 'Light theme'}
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
