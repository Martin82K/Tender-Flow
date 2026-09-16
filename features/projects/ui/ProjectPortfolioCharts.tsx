import React from 'react';
import type { Project } from '@/types';
import type { ProjectPortfolioSummary } from '@features/projects/api/projectOverviewSummaryApi';

export function PortfolioDeadline({ summary, loading }: { summary?: ProjectPortfolioSummary; loading: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = (summary?.deadlines ?? []).flatMap(item => {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(item.date);
    if (!match) return [];
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return [];
    return [{ ...item, date }];
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
  const next = dates.find(item => item.date >= today) ?? dates.at(-1);
  if (!summary) return <span className="text-xs text-slate-500">{loading ? 'Načítání…' : 'Souhrn není dostupný'}</span>;
  if (!next) return <div><span>—</span><p className="mt-1 text-xs text-slate-500">Bez termínu nabídky</p></div>;
  // UTC day numbers avoid daylight-saving transitions when computing calendar-day differences.
  const days = Math.round((Date.UTC(next.date.getFullYear(), next.date.getMonth(), next.date.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
  const relative = days === 0 ? 'dnes' : days === 1 ? 'zítra' : days > 1 ? `za ${days} dní` : 'po termínu';
  return <div className="min-w-0 text-sm">
    <span>{next.date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })} · {relative}</span>
    <p className="mt-1 break-words text-xs text-slate-500">Nabídky · {next.title}</p>
  </div>;
}

export function ProjectPortfolioCharts({ projects, summaries, loading }: {
  projects: Project[];
  summaries?: Record<string, ProjectPortfolioSummary>;
  loading: boolean;
}) {
  const realization = projects.filter(project => project.status === 'realization').length;
  const tender = projects.length - realization;
  const percent = (count: number) => projects.length ? Math.round(count / projects.length * 100) : 0;
  const complete = projects.every(project => summaries?.[project.id]);
  const total = projects.reduce((sum, project) => sum + (summaries?.[project.id]?.openCount ?? 0), 0);
  const max = Math.max(1, ...projects.map(project => summaries?.[project.id]?.openCount ?? 0));
  return <div className="tf-portfolio-charts mb-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
    <section aria-label="Stav portfolia" className="tf-portfolio-chart rounded-xl p-6">
      <h2 className="text-base font-semibold">Stav portfolia</h2>
      <p className="mb-4 mt-2 text-xs text-slate-500">{projects.length} staveb ve výběru</p>
      <div aria-hidden="true" className="flex h-5 gap-1 overflow-hidden rounded">
        {realization > 0 && <div className="tf-portfolio-bar-realization rounded" style={{ flex: realization }} />}
        {tender > 0 && <div className="tf-portfolio-bar-tender rounded" style={{ flex: tender }} />}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
        <span><i aria-hidden="true" className="tf-portfolio-bar-realization mr-2 inline-block size-2 rounded-full" />V realizaci {realization} ({percent(realization)} %)</span>
        <span><i aria-hidden="true" className="tf-portfolio-bar-tender mr-2 inline-block size-2 rounded-full" />V soutěži {tender} ({percent(tender)} %)</span>
      </div>
    </section>
    <section aria-label="Otevřená výběrová řízení" className="tf-portfolio-chart rounded-xl p-6">
      <h2 className="text-base font-semibold">Otevřená výběrová řízení</h2>
      <p className="mb-4 mt-2 text-xs text-slate-500">{complete ? `${total} celkem · podle stavby` : loading ? 'Načítání souhrnů…' : 'Souhrn některých staveb není dostupný'}</p>
      <div className="max-h-64 space-y-3 overflow-y-auto">
        {projects.map(project => {
          const count = summaries?.[project.id]?.openCount;
          return <div key={project.id} className="grid grid-cols-[minmax(0,1fr)_minmax(60px,1.6fr)_2rem] items-center gap-3 text-xs">
            <span className="truncate" title={project.name}>{project.name}</span>
            <div aria-hidden="true" className="tf-portfolio-bar-track h-3.5 overflow-hidden">
              {count !== undefined && <div className="tf-portfolio-bar-realization h-full" style={{ width: `${count / max * 100}%` }} />}
            </div>
            <span aria-label={`${project.name}: ${count ?? 'nedostupné'} otevřených VŘ`}>{count ?? '—'}</span>
          </div>;
        })}
        {!projects.length && <p className="text-xs text-slate-500">Žádné stavby ve výběru.</p>}
      </div>
    </section>
  </div>;
}
