import React from 'react';

/** A compact Gantt chart with staggered tasks and a milestone. */
export function ScheduleIcon({ className }: { className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 3v18h17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".45" />
    <path d="M11 4v16M18 4v16" stroke="currentColor" strokeWidth="1" strokeDasharray="1 3" opacity=".25" />
    <rect x="7" y="5" width="9" height="3" rx="1" fill="currentColor" />
    <rect x="10" y="10" width="11" height="3" rx="1" fill="currentColor" opacity=".75" />
    <rect x="7" y="15" width="6" height="3" rx="1" fill="currentColor" opacity=".55" />
    <path d="m18 14 2.5 2.5L18 19l-2.5-2.5L18 14Z" fill="currentColor" />
  </svg>;
}
