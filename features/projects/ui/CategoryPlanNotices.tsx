import type { CategoryPlanNotice } from '../hooks/useCategoryPlanRecovery';

export function CategoryPlanNotices({ notices = [], onRetry, onDismiss }: {
  notices: CategoryPlanNotice[];
  onRetry: (key: string) => Promise<void>;
  onDismiss: (key: string) => void;
}) {
  return <>{notices.map(notice => (
    <div key={notice.key} role={notice.status === 'error' ? 'alert' : 'status'}
      className="m-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <span>{notice.status === 'syncing'
        ? `Kategorie „${notice.categoryTitle}“ je uložena. Synchronizuji plán VŘ…`
        : notice.status === 'error'
          ? `Kategorie „${notice.categoryTitle}“ je uložena, ale plán VŘ se nepodařilo synchronizovat.`
          : `Kategorie „${notice.categoryTitle}“ i plán VŘ jsou uloženy.`}</span>
      {notice.status !== 'complete' && <button type="button" disabled={notice.status === 'syncing'}
        className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => void onRetry(notice.key)}>
        {notice.status === 'syncing' ? 'Synchronizuji…' : 'Opakovat synchronizaci plánu VŘ'}
      </button>}
      {notice.status !== 'syncing' && <button type="button" className="rounded border px-3 py-1" onClick={() => onDismiss(notice.key)}>Zavřít</button>}
    </div>
  ))}</>;
}
