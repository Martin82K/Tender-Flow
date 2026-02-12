import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TemplatesSection } from '../components/projectLayoutComponents/documents/TemplatesSection';
import { ProjectDetails } from '../types';

const mockProject = {
    id: '1',
    inquiryLetterLink: 'template:123',
    materialInquiryTemplateLink: null,
    losersEmailTemplateLink: null,
} as unknown as ProjectDetails;

describe('TemplatesSection', () => {
    const defaultProps = {
        project: mockProject,
        templateName: 'My Template',
        materialTemplateName: null,
        losersTemplateName: null,
        openTemplateManager: vi.fn(),
    };

    it('renders correctly', () => {
        render(<TemplatesSection {...defaultProps} />);
        expect(screen.getByText('Šablony')).toBeInTheDocument();
        expect(screen.getByText('Šablona poptávek')).toBeInTheDocument();
        expect(screen.getByText('Šablona materiálové poptávky')).toBeInTheDocument();
        expect(screen.getByText('Šablona emailu nevybraným')).toBeInTheDocument();
    });

    it('displays template name for connected template', () => {
        render(<TemplatesSection {...defaultProps} />);
        expect(screen.getByText('My Template')).toBeInTheDocument();
        expect(screen.getByText('wysiwyg')).toBeInTheDocument(); // Icon for template
    });

    it('displays warning when template is not set', () => {
        render(<TemplatesSection {...defaultProps} />);
        expect(screen.getAllByText(/Nenastaveno/).length).toBeGreaterThan(0);
    });

    it('calls openTemplateManager whith correct args', () => {
        render(<TemplatesSection {...defaultProps} />);
        const inquiryRow = screen.getByText('Šablona poptávek').closest('tr')!;
        const changeButton = within(inquiryRow).getByRole('button', { name: /Změnit/i });
        fireEvent.click(changeButton!);
        expect(defaultProps.openTemplateManager).toHaveBeenCalledWith({
            target: { kind: 'inquiry' },
            initialLink: 'template:123',
        });
    });

    it('calls openTemplateManager for material template', () => {
        render(<TemplatesSection {...defaultProps} />);
        const materialRow = screen.getByText('Šablona materiálové poptávky').closest('tr')!;
        const selectButton = within(materialRow).getByRole('button', { name: /Vybrat/i });
        fireEvent.click(selectButton);
        expect(defaultProps.openTemplateManager).toHaveBeenCalledWith({
            target: { kind: 'materialInquiry' },
            initialLink: '',
        });
    });

    it('calls openTemplateManager for losers template', () => {
        render(<TemplatesSection {...defaultProps} />);
        const losersRow = screen.getByText('Šablona emailu nevybraným').closest('tr')!;
        const selectButton = within(losersRow).getByRole('button', { name: /Vybrat/i });
        fireEvent.click(selectButton);
        expect(defaultProps.openTemplateManager).toHaveBeenCalledWith({
            target: { kind: 'losers' },
            initialLink: '',
        });
    });
});
