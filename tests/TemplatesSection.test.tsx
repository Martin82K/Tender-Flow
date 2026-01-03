import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TemplatesSection } from '../components/projectLayoutComponents/documents/TemplatesSection';
import { ProjectDetails } from '../types';

const mockProject = {
    id: '1',
    inquiryLetterLink: 'template:123',
    losersEmailTemplateLink: null,
} as unknown as ProjectDetails;

describe('TemplatesSection', () => {
    const defaultProps = {
        project: mockProject,
        templateName: 'My Template',
        losersTemplateName: null,
        openTemplateManager: vi.fn(),
    };

    it('renders correctly', () => {
        render(<TemplatesSection {...defaultProps} />);
        expect(screen.getByText('Šablony')).toBeInTheDocument();
        expect(screen.getByText('Šablona poptávek')).toBeInTheDocument();
        expect(screen.getByText('Šablona emailu nevybraným')).toBeInTheDocument();
    });

    it('displays template name for connected template', () => {
        render(<TemplatesSection {...defaultProps} />);
        expect(screen.getByText('My Template')).toBeInTheDocument();
        expect(screen.getByText('wysiwyg')).toBeInTheDocument(); // Icon for template
    });

    it('displays warning when template is not set', () => {
        render(<TemplatesSection {...defaultProps} />);
        expect(screen.getByText(/Nenastaveno/)).toBeInTheDocument();
    });

    it('calls openTemplateManager whith correct args', () => {
        render(<TemplatesSection {...defaultProps} />);
        // First row is inquiry. Button text is 'Změnit'
        const changeButton = screen.getByText('Změnit').closest('button');
        fireEvent.click(changeButton!);
        expect(defaultProps.openTemplateManager).toHaveBeenCalledWith({
            target: { kind: 'inquiry' },
            initialLink: 'template:123',
        });
    });

    it('calls openTemplateManager for losers template', () => {
        render(<TemplatesSection {...defaultProps} />);
        const selectButton = screen.getByText('Vybrat').closest('button');
        fireEvent.click(selectButton!);
        expect(defaultProps.openTemplateManager).toHaveBeenCalledWith({
            target: { kind: 'losers' },
            initialLink: '',
        });
    });
});
