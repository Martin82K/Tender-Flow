import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortfolioAnalyticsSummary } from '@/features/projects/ui/PortfolioAnalyticsSummary';

describe('PortfolioAnalyticsSummary', () => {
  it('shows portfolio totals without the misleading phase success comparison', () => {
    render(<PortfolioAnalyticsSummary awardedValue={1250000} demandCount={10} supplierCount={8} offerCount={4} />);
    expect(screen.getByText(/1\s250\s000/)).toBeInTheDocument();
    expect(screen.getByText('Poptaní dodavatelé')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Úspěšnost|Porovnání podle fáze/)).not.toBeInTheDocument();
  });
});
