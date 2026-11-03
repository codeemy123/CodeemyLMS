'use client';

export const Badge = ({ children }) => (
  <span
    className={
      'badge ' + (['Pending', 'Upcoming', 'In progress'].includes(children) ? 'amber' : '')
    }
  >
    {children}
  </span>
);
export const Progress = ({ value }) => (
  <div className="progress">
    <i style={{ width: value + '%' }} />
  </div>
);
export const Button = ({
  children,
  onClick,
  secondary = false,
  type = 'button',
  className = '',
  disabled = false,
}) => (
  <button
    type={type}
    className={['btn', secondary && 'secondary', className].filter(Boolean).join(' ')}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);
