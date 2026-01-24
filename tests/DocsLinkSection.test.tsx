import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DocsLinkSection } from '../components/projectLayoutComponents/documents/DocsLinkSection';
import type { ProjectDetails } from '../types';

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({ user: null }),
}));

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
        onUpdate: vi.fn(),
    };

    it('renders correctly in view mode with link', () => {
        render(<DocsLinkSection {...defaultProps} />);
        expect(screen.getByText('Dokumenty projektu')).toBeInTheDocument();
        expect(screen.getByText('PD')).toBeInTheDocument();
        expect(screen.getByText('https://docs.com')).toBeInTheDocument();
    });

    it('renders correctly in view mode without link', () => {
        render(<DocsLinkSection {...defaultProps} hasDocsLink={false} project={{ ...mockProject, documentationLink: '' } as any} />);
        expect(screen.getByText('Dokumenty projektu')).toBeInTheDocument();
        expect(screen.getByText('Zatím nemáte žádné odkazy na dokumenty. Přidejte první odkaz.')).toBeInTheDocument();
    });

    it('switches to edit mode on edit click', () => {
        render(<DocsLinkSection {...defaultProps} />);
        // Find button that contains 'edit' text (material icon)
        const editButton = screen.getByText('edit').closest('button');
        fireEvent.click(editButton!);
        expect(defaultProps.onEditToggle).toHaveBeenCalledWith(true);
    });

    it('shows add link form when requested', () => {
        render(<DocsLinkSection {...defaultProps} />);
        fireEvent.click(screen.getByText('Přidat odkaz'));
        expect(screen.getByPlaceholderText('Název (např. PD Hlavní budova)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('URL nebo cesta (např. https://... nebo C:\\Projekty\\...)')).toBeInTheDocument();
    });

    it('calls onUpdate when adding new link', () => {
        Object.defineProperty(global, 'crypto', {
            value: { randomUUID: () => 'link-1' },
            writable: true,
        });
        render(<DocsLinkSection {...defaultProps} />);

        fireEvent.click(screen.getByText('Přidat odkaz'));
        fireEvent.change(screen.getByPlaceholderText('Název (např. PD Hlavní budova)'), {
            target: { value: 'Rozpocet' },
        });
        fireEvent.change(screen.getByPlaceholderText('URL nebo cesta (např. https://... nebo C:\\Projekty\\...)'), {
            target: { value: 'https://new.com' },
        });
        fireEvent.click(screen.getByText('Přidat'));

        expect(defaultProps.onUpdate).toHaveBeenCalledWith({
            documentLinks: [
                expect.objectContaining({
                    id: 'link-1',
                    label: 'Rozpocet',
                    url: 'https://new.com',
                    dateAdded: expect.any(String),
                }),
            ],
        });
    });

    it('shows DocHub link if connected', () => {
        render(<DocsLinkSection {...defaultProps} isDocHubConnected={true} docHubPdLink="https://dochub.com/pd" />);
        expect(screen.getByText('DocHub /pd_folder')).toBeInTheDocument();
        expect(screen.getByText('Otevřít')).toBeInTheDocument();
    });
});
