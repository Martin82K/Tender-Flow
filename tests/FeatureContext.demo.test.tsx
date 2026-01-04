import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FeatureProvider, useFeatures } from '../context/FeatureContext';
import { FEATURES } from '../config/features';

const subscriptionServiceMocks = vi.hoisted(() => ({
  getUserEnabledFeatures: vi.fn(async () => []),
  getUserSubscriptionTier: vi.fn(async () => 'free'),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'demo-user',
      name: 'Demo Uživatel',
      email: 'demo@example.com',
      role: 'demo',
      preferences: {},
    },
    isAuthenticated: true,
  }),
}));

vi.mock('../services/subscriptionFeaturesService', () => ({
  subscriptionFeaturesService: {
    getUserEnabledFeatures: subscriptionServiceMocks.getUserEnabledFeatures,
    getUserSubscriptionTier: subscriptionServiceMocks.getUserSubscriptionTier,
  },
}));

function Probe() {
  const { hasFeature, currentPlan } = useFeatures();
  return (
    <div>
      <div data-testid="plan">{currentPlan}</div>
      <div data-testid="dashboard">{String(hasFeature(FEATURES.MODULE_DASHBOARD))}</div>
      <div data-testid="projects">{String(hasFeature(FEATURES.MODULE_PROJECTS))}</div>
      <div data-testid="contacts">{String(hasFeature(FEATURES.MODULE_CONTACTS))}</div>
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
    expect(screen.getByTestId('dashboard').textContent).toBe('true');
    expect(screen.getByTestId('projects').textContent).toBe('true');
    expect(screen.getByTestId('contacts').textContent).toBe('true');
    expect(subscriptionServiceMocks.getUserEnabledFeatures).not.toHaveBeenCalled();
    expect(subscriptionServiceMocks.getUserSubscriptionTier).not.toHaveBeenCalled();
  });
});
