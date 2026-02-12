import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocsLinkSection } from '../components/projectLayoutComponents/documents/DocsLinkSection';
import type { ProjectDetails } from '../types';

const mockUseAuth = vi.fn();
const mockShortenUrl = vi.fn();

vi.mock('../context/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../services/urlShortenerService', () => ({
    shortenUrl: (...args: any[]) => mockShortenUrl(...args),
}));

const mockProject = {
    id: '1',
    documentationLink: 'https://docs.com',
} as unknown as ProjectDetails;

describe('DocsLinkSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue({ user: null });
        mockShortenUrl.mockResolvedValue({
            success: true,
            shortUrl: 'https://tinyurl.com/test',
            originalUrl: 'https://example.com/very-long-url',
            provider: 'tinyurl',
        });
    });

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

    it('auto-shortens when preference is enabled and URL is public', async () => {
        mockUseAuth.mockReturnValue({
            user: {
                preferences: { autoShortenProjectDocs: true },
            },
        });
        mockShortenUrl.mockResolvedValueOnce({
            success: true,
            shortUrl: 'https://tinyurl.com/public',
            originalUrl: 'https://example.com/very-long-url',
            provider: 'tinyurl',
        });

        Object.defineProperty(global, 'crypto', {
            value: { randomUUID: () => 'link-public' },
            writable: true,
        });

        render(<DocsLinkSection {...defaultProps} />);

        fireEvent.click(screen.getByText('Přidat odkaz'));
        fireEvent.change(screen.getByPlaceholderText('Název (např. PD Hlavní budova)'), {
            target: { value: 'Veřejný odkaz' },
        });
        fireEvent.change(screen.getByPlaceholderText('URL nebo cesta (např. https://... nebo C:\\Projekty\\...)'), {
            target: { value: 'https://example.com/very-long-url' },
        });
        fireEvent.click(screen.getByText('Přidat'));

        await waitFor(() => {
            expect(mockShortenUrl).toHaveBeenCalledWith('https://example.com/very-long-url');
        });
        expect(defaultProps.onUpdate).toHaveBeenCalledWith({
            documentLinks: [
                expect.objectContaining({
                    id: 'link-public',
                    label: 'Veřejný odkaz',
                    url: 'https://tinyurl.com/public',
                }),
            ],
        });
    });

    it('does not auto-shorten local/internal URL even when preference is enabled', async () => {
        mockUseAuth.mockReturnValue({
            user: {
                preferences: { autoShortenProjectDocs: true },
            },
        });

        Object.defineProperty(global, 'crypto', {
            value: { randomUUID: () => 'link-local' },
            writable: true,
        });

        render(<DocsLinkSection {...defaultProps} />);

        fireEvent.click(screen.getByText('Přidat odkaz'));
        fireEvent.change(screen.getByPlaceholderText('Název (např. PD Hlavní budova)'), {
            target: { value: 'Lokální odkaz' },
        });
        fireEvent.change(screen.getByPlaceholderText('URL nebo cesta (např. https://... nebo C:\\Projekty\\...)'), {
            target: { value: 'http://localhost:3000/private-docs' },
        });
        fireEvent.click(screen.getByText('Přidat'));

        await waitFor(() => {
            expect(defaultProps.onUpdate).toHaveBeenCalled();
        });
        expect(mockShortenUrl).not.toHaveBeenCalled();
        expect(defaultProps.onUpdate).toHaveBeenCalledWith({
            documentLinks: [
                expect.objectContaining({
                    id: 'link-local',
                    label: 'Lokální odkaz',
                    url: 'http://localhost:3000/private-docs',
                }),
            ],
        });
    });
});
