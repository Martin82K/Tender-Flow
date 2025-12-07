import { Template } from '../types';

export const INITIAL_TEMPLATES: Template[] = [
    {
        id: '1',
        name: 'Standardní poptávka',
        subject: 'Poptávka: {NAZEV_STAVBY} - {KATEGORIE_NAZEV}',
        content: `Dobrý den,

u stavby <b>{NAZEV_STAVBY}</b> ({LOKACE}) poptáváme:

<b>{KATEGORIE_NAZEV}</b>

Termín realizace: dle dohody
Termín dokončení stavby: {TERMIN_DOKONCENI}

<b>Podmínky:</b>
Splatnost: {SPLATNOST}
Záruka: {ZARUKA}
Pozastávka: {POZASTAVKA}

Prosíme o nacenění dle přiložené dokumentace:
{ODKAZ_DOKUMENTACE}

S pozdravem,
{STAVBYVEDOUCI}`,
        isDefault: true,
        lastModified: '2024-03-20'
    },
    {
        id: '2',
        name: 'Anglická verze',
        subject: 'Inquiry: {NAZEV_STAVBY} - {KATEGORIE_NAZEV}',
        content: `Dear partners,

We are looking for subcontractors for project <b>{NAZEV_STAVBY}</b> located in {LOKACE}.

Scope of work:
<b>{KATEGORIE_NAZEV}</b>

Completion date: {TERMIN_DOKONCENI}

Please send your quotation based on documentation:
{ODKAZ_DOKUMENTACE}

Best regards,
{STAVBYVEDOUCI}`,
        isDefault: false,
        lastModified: '2024-03-22'
    }
];

const STORAGE_KEY = 'crm_templates_v1';

const loadTemplates = (): Template[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load templates', e);
    }
    return INITIAL_TEMPLATES;
};

// In-memory cache
let templatesStore = loadTemplates();

const persist = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templatesStore));
    } catch (e) {
        console.error('Failed to save templates', e);
    }
};

export const getTemplates = (): Template[] => {
    return templatesStore;
};

export const getTemplateById = (id: string): Template | undefined => {
    return templatesStore.find(t => t.id === id);
};

export const saveTemplate = (template: Template): void => {
    const index = templatesStore.findIndex(t => t.id === template.id);
    if (index >= 0) {
        templatesStore[index] = template;
    } else {
        templatesStore.push(template);
    }
    persist();
};

export const deleteTemplate = (id: string): void => {
    templatesStore = templatesStore.filter(t => t.id !== id);
    persist();
};
