import React from 'react';
import type { ContractStatus } from '@/types';

const STATUS_STYLES: Record<ContractStatus, { label: string; className: string }> = {
  draft: {
    label: 'Rozpracováno',
    className: 'text-blue-600 dark:text-blue-400',
  },
  active: {
    label: 'Aktivní',
    className: 'text-green-600 dark:text-green-400',
  },
  closed: {
    label: 'Uzavřeno',
    className: 'text-slate-600 dark:text-slate-400',
  },
  cancelled: {
    label: 'Zrušeno',
    className: 'text-red-600 dark:text-red-400',
  },
};

export const StatusPill: React.FC<{ status: ContractStatus }> = ({ status }) => {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span
      className={`text-[10.5px] font-bold tracking-wide uppercase ${style.className}`}
    >
      {style.label}
    </span>
  );
};
