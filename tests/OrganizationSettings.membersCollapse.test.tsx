import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationSettings } from '../features/settings/OrganizationSettings';

const organizationServiceMocks = vi.hoisted(() => ({
  getMyOrganizations: vi.fn(),
  getOrganizationMembers: vi.fn(),
  getOrganizationUnlockerTimeSavings: vi.fn(),
  getOrganizationJoinRequests: vi.fn(),
  addOrganizationMemberByEmail: vi.fn(),
  updateOrganizationMemberRole: vi.fn(),
  transferOrganizationOwnership: vi.fn(),
  approveJoinRequest: vi.fn(),
  rejectJoinRequest: vi.fn(),
}));

const userManagementServiceMocks = vi.hoisted(() => ({
  getAllUsers: vi.fn(),
}));

vi.mock('../context/UIContext', () => ({
  useUI: () => ({
    uiModal: {
      isOpen: false,
      title: '',
      message: '',
      variant: 'info',
      confirmLabel: 'OK',
    },
    showUiModal: vi.fn(),
    showAlert: vi.fn(),
    showConfirm: vi.fn().mockResolvedValue(true),
    closeUiModal: vi.fn(),
    isSidebarOpen: true,
    setIsSidebarOpen: vi.fn(),
    toggleSidebar: vi.fn(),
  }),
}));

vi.mock('../services/organizationService', () => ({
  organizationService: organizationServiceMocks,
}));

vi.mock('../services/userManagementService', () => ({
  userManagementService: userManagementServiceMocks,
}));

const createMembers = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    user_id: `user-${index + 1}`,
    email: `user${String(index + 1).padStart(2, '0')}@example.com`,
    display_name: `User ${String(index + 1).padStart(2, '0')}`,
    role: 'member' as const,
    joined_at: `2026-02-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
  }));

describe('OrganizationSettings - sbalení členů', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    organizationServiceMocks.getMyOrganizations.mockResolvedValue([
      {
        organization_id: 'org-1',
        organization_name: 'Baustav',
        member_role: 'owner',
        domain_whitelist: ['baustav.cz'],
      },
    ]);
    organizationServiceMocks.getOrganizationMembers.mockResolvedValue(createMembers(8));
    organizationServiceMocks.getOrganizationUnlockerTimeSavings.mockResolvedValue(null);
    organizationServiceMocks.getOrganizationJoinRequests.mockResolvedValue([]);
    userManagementServiceMocks.getAllUsers.mockResolvedValue([]);
  });

  it('defaultně zobrazí jen první část členů a tlačítko pro rozbalení', async () => {
    render(<OrganizationSettings />);

    expect(await screen.findByText('User 01')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('User 06')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Zobrazit další (5)' })).toBeInTheDocument();
  });

  it('po kliknutí rozbalí seznam a umožní ho sbalit zpět', async () => {
    render(<OrganizationSettings />);

    const expandButton = await screen.findByRole('button', { name: 'Zobrazit další (5)' });
    fireEvent.click(expandButton);

    expect(await screen.findByText('User 06')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sbalit členy' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sbalit členy' }));

    await waitFor(() => {
      expect(screen.queryByText('User 06')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Zobrazit další (5)' })).toBeInTheDocument();
  });
});
