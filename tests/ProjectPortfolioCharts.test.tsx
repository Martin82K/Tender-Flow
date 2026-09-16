import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortfolioDeadline, ProjectPortfolioCharts } from '@features/projects/ui/ProjectPortfolioCharts';

const projects = [{ id: 'a', name: 'Alfa', location: '', status: 'tender' as const }, { id: 'b', name: 'Beta', location: '', status: 'realization' as const }];
afterEach(() => vi.useRealTimers());
describe('portfolio summary states', () => {
  it('shows the most recent overdue deadline when every date is in the past', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 15, 12));
    render(<PortfolioDeadline loading={false} summary={{ openCount: 3, deadlines: [
      { date: '2026-01-01', title: 'Nejstarší' },
      { date: '2026-09-14', title: 'Včerejší' },
      { date: '2026-05-01', title: 'Květnový' },
    ] }} />);
    expect(screen.getByText('Nabídky · Včerejší')).toBeInTheDocument();
    expect(screen.getByText(/po termínu/)).toBeInTheDocument();
    expect(screen.queryByText('Nabídky · Nejstarší')).not.toBeInTheDocument();
  });
  it('uses the same selected projects for totals, status proportions and bars', () => {
    const summaries = { a: { openCount: 2, deadlines: [] }, b: { openCount: 5, deadlines: [] } };
    const { rerender } = render(<ProjectPortfolioCharts projects={projects} summaries={summaries} loading={false} />);
    expect(screen.getByText('7 celkem · podle stavby')).toBeInTheDocument();
    expect(screen.getByText('V realizaci 1 (50 %)')).toBeInTheDocument();
    rerender(<ProjectPortfolioCharts projects={[projects[1]]} summaries={summaries} loading={false} />);
    expect(screen.getByText('5 celkem · podle stavby')).toBeInTheDocument();
    expect(screen.getByText('V realizaci 1 (100 %)')).toBeInTheDocument();
    expect(screen.queryByText('Alfa')).not.toBeInTheDocument();
  });
  it('does not report missing summary data as zero', () => {
    render(<ProjectPortfolioCharts projects={projects} summaries={{}} loading={false} />);
    expect(screen.getByText('Souhrn některých staveb není dostupný')).toBeInTheDocument();
    expect(screen.queryByText('0 celkem · podle stavby')).not.toBeInTheDocument();
  });
  it('selects the nearest future date, ignores invalid dates and labels overdue dates', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 15, 12));
    const { rerender } = render(<PortfolioDeadline loading={false} summary={{ openCount: 4, deadlines: [
      { date: '2026-09-10', title: 'Staré' }, { date: '2026-09-20', title: 'Okna' },
      { date: '2026-09-16', title: 'Dveře' }, { date: '2026-02-31', title: 'Chybné' },
    ] }} />);
    expect(screen.getByText(/zítra/)).toBeInTheDocument();
    expect(screen.getByText('Nabídky · Dveře')).toBeInTheDocument();
    rerender(<PortfolioDeadline loading={false} summary={{ openCount: 1, deadlines: [{ date: '2026-09-10', title: 'Staré' }] }} />);
    expect(screen.getByText(/po termínu/)).toBeInTheDocument();
  });
});
