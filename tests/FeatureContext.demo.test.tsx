import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FeatureProvider, useFeatures } from '../context/FeatureContext';
import { FEATURES } from '../config/features';

const demoAuthState = {
  user: {
    id: 'demo-user',
    name: 'Demo Uživatel',
    email: 'demo@example.com',
    role: 'demo',
    preferences: {},
  },
  isAuthenticated: true,
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => demoAuthState,
}));

vi.mock('@/features/subscription/api', () => ({
  getEnabledFeatures: async () => [],
  getCurrentTier: async () => 'free',
}));

function Probe() {
  const { hasFeature, currentPlan } = useFeatures();
  return (
    <div>
      <div data-testid="plan">{currentPlan}</div>
      <div data-testid="commandCenter">{String(hasFeature(FEATURES.MODULE_COMMAND_CENTER))}</div>
      <div data-testid="projects">{String(hasFeature(FEATURES.MODULE_PROJECTS))}</div>
      <div data-testid="contacts">{String(hasFeature(FEATURES.MODULE_CONTACTS))}</div>
      <div data-testid="excelMerger">{String(hasFeature(FEATURES.EXCEL_MERGER))}</div>
    </div>
  );
}

describe('FeatureProvider (demo mode)', () => {
  it('enables core sidebar modules without backend RPC', async () => {
    render(
      <FeatureProvider>
        <Probe />
      </FeatureProvider>
    );

    await waitFor(() => expect(screen.getByTestId('plan').textContent).toBe('demo'));
    expect(screen.getByTestId('commandCenter').textContent).toBe('true');
    expect(screen.getByTestId('projects').textContent).toBe('true');
    expect(screen.getByTestId('contacts').textContent).toBe('true');
    expect(screen.getByTestId('excelMerger').textContent).toBe('false');
  });
});
