import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocsLinkSection } from '../components/projectLayoutComponents/documents/DocsLinkSection';
import type { ProjectDetails } from '../types';

const mockUseAuth = vi.fn();
const mockShortenUrl = vi.fn();
const platformMocks = vi.hoisted(() => ({
    isDesktop: false,
    openExternal: vi.fn(),
}));
const mockOpenInExplorer = vi.hoisted(() => vi.fn());

vi.mock('../context/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../services/urlShortenerService', () => ({
    shortenUrl: (...args: any[]) => mockShortenUrl(...args),
}));

vi.mock('../services/platformAdapter', () => ({
    get isDesktop() {
        return platformMocks.isDesktop;
    },
    shellAdapter: {
        openExternal: (...args: any[]) => platformMocks.openExternal(...args),
    },
}));

vi.mock('../services/fileSystemService', () => ({
    openInExplorer: (...args: any[]) => mockOpenInExplorer(...args),
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
        platformMocks.isDesktop = false;
        platformMocks.openExternal.mockResolvedValue(undefined);
        mockOpenInExplorer.mockResolvedValue({ success: true });
    });

    const defaultProps = {
        project: mockProject,
        hasDocsLink: true,
        isEditing: false,
        onEditToggle: vi.fn(),
        linkValue: '',
        onLinkValueChange: vi.fn(),
        onSave: vi.fn(),
        showModal: vi.fn(),
        onUpdate: vi.fn(),
    };

    it('renders correctly in view mode with link', () => {
        const { container } = render(<DocsLinkSection {...defaultProps} />);
        expect(screen.getByText('Dokumenty projektu')).toBeInTheDocument();
        expect(screen.getByText('PD')).toBeInTheDocument();
        expect(screen.getByText('https://docs.com')).toBeInTheDocument();
        expect(container.querySelector('[data-help-id="documents-link-card"]')).toBeInTheDocument();
        expect(container.querySelector('[data-help-id="documents-link-row"]')).toBeInTheDocument();
        expect(container.querySelector('[data-help-id="documents-status-badge"]')).toBeInTheDocument();
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

    it('opens project documentation URL through the platform shell adapter', async () => {
        render(<DocsLinkSection {...defaultProps} />);

        fireEvent.click(screen.getByTitle('Otevřít'));

        await waitFor(() => {
            expect(platformMocks.openExternal).toHaveBeenCalledWith('https://docs.com');
        });
    });

    it('shows a copyable error when external URL opening is blocked', async () => {
        platformMocks.openExternal.mockRejectedValueOnce(new Error('Blocked external URL host'));
        const showModal = vi.fn();

        render(<DocsLinkSection {...defaultProps} showModal={showModal} />);

        fireEvent.click(screen.getByTitle('Otevřít'));

        await waitFor(() => {
            expect(showModal).toHaveBeenCalledWith({
                title: 'Odkaz se nepodařilo otevřít',
                message: 'Zkontrolujte, že je odkaz platný a povolený pro otevření v aplikaci.',
                variant: 'danger',
                copyableText: 'https://docs.com',
            });
        });
    });

    it('opens a local documentation path in Explorer in desktop mode', async () => {
        platformMocks.isDesktop = true;
        const project = {
            ...mockProject,
            documentationLink: 'C:\\Users\\touaplikova\\OneDrive - BAU-STAV a.s\\25007\\000_TF\\03_Vyberova_rizeni\\22 povlakové',
        } as unknown as ProjectDetails;

        render(<DocsLinkSection {...defaultProps} project={project} />);

        fireEvent.click(screen.getByTitle('Otevřít'));

        await waitFor(() => {
            expect(mockOpenInExplorer).toHaveBeenCalledWith(project.documentationLink);
        });
        expect(defaultProps.showModal).not.toHaveBeenCalled();
    });

    it('shows a copyable error when opening a local desktop path fails', async () => {
        platformMocks.isDesktop = true;
        mockOpenInExplorer.mockResolvedValueOnce({ success: false, error: 'access denied' });
        const showModal = vi.fn();
        const project = {
            ...mockProject,
            documentationLink: 'C:\\Users\\touaplikova\\OneDrive - BAU-STAV a.s\\25007\\000_TF\\03_Vyberova_rizeni\\22 povlakové',
        } as unknown as ProjectDetails;

        render(<DocsLinkSection {...defaultProps} project={project} showModal={showModal} />);

        fireEvent.click(screen.getByTitle('Otevřít'));

        await waitFor(() => {
            expect(showModal).toHaveBeenCalledWith({
                title: 'Složku se nepodařilo otevřít',
                message: 'Aplikace nemá přístup k této lokální cestě nebo složka neexistuje. Cestu můžete zkopírovat ručně:',
                variant: 'danger',
                copyableText: project.documentationLink,
            });
        });
    });

    it('copies a local documentation path in web mode', async () => {
        const writeTextSpy = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: {
                writeText: writeTextSpy,
            },
        });
        const showModal = vi.fn();
        const project = {
            ...mockProject,
            documentationLink: 'C:\\Users\\touaplikova\\OneDrive - BAU-STAV a.s\\25007\\000_TF\\03_Vyberova_rizeni\\22 povlakové',
        } as unknown as ProjectDetails;

        render(<DocsLinkSection {...defaultProps} project={project} showModal={showModal} />);

        fireEvent.click(screen.getByTitle('Zkopírovat'));

        await waitFor(() => {
            expect(writeTextSpy).toHaveBeenCalledWith(project.documentationLink);
        });
        expect(mockOpenInExplorer).not.toHaveBeenCalled();
        expect(showModal).toHaveBeenCalledWith({
            title: 'Zkopírováno',
            message: project.documentationLink,
            variant: 'success',
        });
    });

    it('shows add link form when requested', () => {
        const { container } = render(<DocsLinkSection {...defaultProps} />);
        fireEvent.click(screen.getByText('Přidat odkaz'));
        expect(screen.getByPlaceholderText('Název (např. PD Hlavní budova)')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('URL nebo cesta (např. https://... nebo C:\\Projekty\\...)')).toBeInTheDocument();
        expect(container.querySelector('[data-help-id="documents-save-link"]')).toBeInTheDocument();
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
