import { Template } from '../types';
import { supabase } from './supabase';

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

export const getTemplates = async (): Promise<Template[]> => {
    try {
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching templates:', error);
            return INITIAL_TEMPLATES;
        }

        if (!data || data.length === 0) {
            // Seed initial templates if DB is empty
            // Note: In a real app we might want to do this via migration or admin tool,
            // but here we want to ensure user sees something.
            // However, we won't auto-save them to DB here to avoid duplication issues
            // if multiple users hit this. Just returning them.
            return INITIAL_TEMPLATES;
        }

        return data.map(t => ({
            id: t.id,
            name: t.name,
            subject: t.subject,
            content: t.content,
            isDefault: t.is_default,
            lastModified: t.updated_at ? new Date(t.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }));
    } catch (e) {
        console.error('Failed to load templates', e);
        return INITIAL_TEMPLATES;
    }
};

export const getTemplateById = async (id: string): Promise<Template | undefined> => {
    try {
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            // Fallback to initial templates if not found in DB (e.g. for default ones if not yet saved)
            return INITIAL_TEMPLATES.find(t => t.id === id);
        }

        return {
            id: data.id,
            name: data.name,
            subject: data.subject,
            content: data.content,
            isDefault: data.is_default,
            lastModified: data.updated_at ? new Date(data.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        };
    } catch (e) {
        console.error('Failed to get template by id', e);
        return undefined;
    }
};

export const saveTemplate = async (template: Template): Promise<Template | null> => {
    try {
        // Map frontend model to DB model
        const dbTemplate = {
            // If ID is numeric (from initial templates) or temporary, let DB generate UUID.
            // But if we are updating, we need the ID.
            // Strategy: 
            // 1. If it's a new template (no ID or temporary ID), we don't send ID to let DB generate generic UUID? 
            //    No, upsert needs ID to update.
            //    If we are UPDATING, we must pass ID.
            //    If we are CREATING, we can omit ID or pass a new UUID.

            // Check if ID is a valid UUID. If not (e.g. '1', '2' from INITIAL), handle it.
            // For simplicity, if it looks like a legacy ID, we might treating it as a new insert if we want to migrate,
            // OR we just generate a new UUID for it.

            name: template.name,
            subject: template.subject,
            content: template.content,
            is_default: template.isDefault,
            updated_at: new Date().toISOString()
        };

        let result;

        // Check if it's a UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(template.id);

        if (isUUID) {
            const { data, error } = await supabase
                .from('templates')
                .upsert({ ...dbTemplate, id: template.id })
                .select()
                .single();
            if (error) throw error;
            result = data;
        } else {
            // It's a new template or legacy ID, insert as new
            const { data, error } = await supabase
                .from('templates')
                .insert(dbTemplate)
                .select()
                .single();
            if (error) throw error;
            result = data;
        }

        return {
            id: result.id,
            name: result.name,
            subject: result.subject,
            content: result.content,
            isDefault: result.is_default,
            lastModified: result.updated_at ? new Date(result.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        };
    } catch (e) {
        console.error('Failed to save template', e);
        return null; // Propagate error handling to UI?
    }
};

export const deleteTemplate = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('templates')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Failed to delete template', e);
        return false;
    }
};
