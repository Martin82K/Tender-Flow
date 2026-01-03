import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DocsLinkSection } from '../components/projectLayoutComponents/documents/DocsLinkSection';
import { ProjectDetails } from '../types';

const mockProject = {
    id: '1',
    documentationLink: 'https://docs.com',
} as unknown as ProjectDetails;

describe('DocsLinkSection', () => {
    const defaultProps = {
        project: mockProject,
        hasDocsLink: true,
        isEditing: false,
        onEditToggle: vi.fn(),
        linkValue: '',
        onLinkValueChange: vi.fn(),
        onSave: vi.fn(),
        isDocHubConnected: false,
        docHubPdLink: null,
        docHubStructure: { pd: 'pd_folder' } as any,
        showModal: vi.fn(),
    };

    it('renders correctly in view mode with link', () => {
        render(<DocsLinkSection {...defaultProps} />);
        expect(screen.getByText('PD (projektová dokumentace)')).toBeInTheDocument();
        expect(screen.getByText('Nastaveno')).toBeInTheDocument();
        expect(screen.getByText('https://docs.com')).toBeInTheDocument();
    });

    it('renders correctly in view mode without link', () => {
        render(<DocsLinkSection {...defaultProps} hasDocsLink={false} project={{ ...mockProject, documentationLink: '' } as any} />);
        expect(screen.queryByText('Nastaveno')).not.toBeInTheDocument();
        expect(screen.getByText('Žádný odkaz není nastaven')).toBeInTheDocument();
    });

    it('switches to edit mode on edit click', () => {
        render(<DocsLinkSection {...defaultProps} />);
        // Find button that contains 'edit' text (material icon)
        const editButton = screen.getByText('edit').closest('button');
        fireEvent.click(editButton!);
        expect(defaultProps.onEditToggle).toHaveBeenCalledWith(true);
    });

    it('renders input in edit mode', () => {
        render(<DocsLinkSection {...defaultProps} isEditing={true} linkValue="https://new.com" />);
        const input = screen.getByDisplayValue('https://new.com');
        expect(input).toBeInTheDocument();

        fireEvent.change(input, { target: { value: 'https://updated.com' } });
        expect(defaultProps.onLinkValueChange).toHaveBeenCalledWith('https://updated.com');
    });

    it('calls onSave on check click', () => {
        render(<DocsLinkSection {...defaultProps} isEditing={true} />);
        const saveButton = screen.getByText('check').closest('button');
        fireEvent.click(saveButton!);
        expect(defaultProps.onSave).toHaveBeenCalled();
    });

    it('shows DocHub link if connected', () => {
        render(<DocsLinkSection {...defaultProps} isDocHubConnected={true} docHubPdLink="https://dochub.com/pd" />);
        expect(screen.getByText('DocHub /pd_folder')).toBeInTheDocument();
        expect(screen.getByText('Otevřít')).toBeInTheDocument();
    });
});
