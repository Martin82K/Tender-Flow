import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/settings/VikiCostControl', () => ({
  VikiCostControl: () => <div data-testid="viki-cost-control" />,
}));

const mockSingle = vi.fn(async () => ({ data: null, error: null }));
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockUpdate = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));

vi.mock('@/services/dbAdapter', () => ({
  dbAdapter: {
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
      upsert: vi.fn(async () => ({ error: null })),
      eq: mockEq,
      single: mockSingle,
    })),
    functions: {
      invoke: vi.fn(async () => ({ data: { models: [] }, error: null })),
    },
  },
}));

import { AISettings } from '@/features/settings/AISettings';

describe('AISettings security policy', () => {
  it('zobrazuje server-only policy a neumožňuje ukládat API klíče v UI', () => {
    render(<AISettings isAdmin />);

    expect(screen.getAllByText(/Supabase Secrets/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Uložit klíče do trezoru/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^API Klíče \(System Secret Storage\)$/i)).not.toBeInTheDocument();
  });
});
