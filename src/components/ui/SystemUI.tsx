import React from 'react';

export const Surface: React.FC<React.HTMLAttributes<HTMLDivElement> & { level?: 'primary'|'secondary'|'utility' }> = ({ level='secondary', className='', ...props }) => (
  <div {...props} className={`ui-surface ui-surface-${level} ${className}`} />
);

export const Skeleton: React.FC<{ className?: string }> = ({ className='' }) => (
  <div aria-hidden="true" className={`ui-skeleton rounded-lg ${className}`} />
);

export const EmptyState: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="ui-empty-state text-center">
    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
    {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);
