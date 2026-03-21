import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PriceListsSection } from '../components/projectLayoutComponents/documents/PriceListsSection';
import { ProjectDetails } from '../types';

const mockProject = {
    id: '1',
    priceListLink: 'https://pricelist.com',
} as unknown as ProjectDetails;

describe('PriceListsSection', () => {
    const defaultProps = {
        project: mockProject,
        isEditing: false,
        onEditToggle: vi.fn(),
        linkValue: '',
        onLinkValueChange: vi.fn(),
        onSave: vi.fn(),
        isDocHubConnected: false,
        docHubCenikyLink: null,
        showModal: vi.fn(),
    };

    it('renders correctly', () => {
        render(<PriceListsSection {...defaultProps} />);
        expect(screen.getByText('Ceníky')).toBeInTheDocument();
        expect(screen.getByText('https://pricelist.com')).toBeInTheDocument();
        expect(screen.getByText('Nastaveno')).toBeInTheDocument();
    });

    it('does not render unsafe javascript price list link', () => {
        render(
            <PriceListsSection
                {...defaultProps}
                project={{ ...mockProject, priceListLink: 'javascript:alert(1)' } as ProjectDetails}
            />,
        );

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByText('Nastaveno')).not.toBeInTheDocument();
    });

    it('renders editing mode correctly', () => {
        render(<PriceListsSection {...defaultProps} isEditing={true} />);
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
    });

    it('shows doc hub link when connected', () => {
        render(<PriceListsSection {...defaultProps} isDocHubConnected={true} docHubCenikyLink="https://dh.com" />);
        expect(screen.getByText('DocHub /Ceníky')).toBeInTheDocument();
    });
});
