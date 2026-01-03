import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutoCreateModal } from '../components/projectLayoutComponents/documents/AutoCreateModal';

describe('AutoCreateModal', () => {
    const defaultProps = {
        result: { createdCount: 5 },
        rootLink: 'https://doc-hub.com/root',
        onClose: vi.fn(),
        onShowLog: vi.fn(),
        onShowOverview: vi.fn(),
    };

    it('renders correctly when result is provided', () => {
        render(<AutoCreateModal {...defaultProps} />);
        expect(screen.getByText('Auto‑vytváření dokončeno')).toBeInTheDocument();
        expect(screen.getByText(/Akcí: 5/)).toBeInTheDocument();
    });

    it('does not render when result is null', () => {
        const { container } = render(<AutoCreateModal {...defaultProps} result={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('calls onClose when close button is clicked', () => {
        render(<AutoCreateModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Zavřít'));
        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onShowLog when log button is clicked', () => {
        render(<AutoCreateModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Zobrazit log'));
        expect(defaultProps.onShowLog).toHaveBeenCalled();
    });

    it('calls onShowOverview when overview button is clicked', () => {
        render(<AutoCreateModal {...defaultProps} />);
        fireEvent.click(screen.getByText('Přehled vytvořených složek'));
        expect(defaultProps.onShowOverview).toHaveBeenCalled();
    });

    it('opens root link in new tab if it is a URL', () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        render(<AutoCreateModal {...defaultProps} />);

        fireEvent.click(screen.getByText('Otevřít root'));

        expect(openSpy).toHaveBeenCalledWith('https://doc-hub.com/root', '_blank', 'noopener,noreferrer');
        openSpy.mockRestore();
    });

    it('copies to clipboard if root link is not a URL', async () => {
        const props = { ...defaultProps, rootLink: '/local/path' };
        const writeTextSpy = vi.fn().mockResolvedValue(undefined);

        // Mock clipboard
        Object.assign(navigator, {
            clipboard: {
                writeText: writeTextSpy,
            },
        });

        render(<AutoCreateModal {...props} />);

        fireEvent.click(screen.getByText('Otevřít root'));

        expect(writeTextSpy).toHaveBeenCalledWith('/local/path');
    });
});
