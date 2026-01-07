import { Template } from '../types';
import { supabase } from './supabase';

export const INITIAL_TEMPLATES: Template[] = [
    {
        id: '0',
        name: 'MK poptávka standard',
        subject: 'Poptávka: {NAZEV_STAVBY} - {KATEGORIE_NAZEV}',
        content: `Dobrý den,

dovoluji si obrátit se na Vás s poptávkou pro výběrové řízení <b>„{KATEGORIE_NAZEV}" </b>pro akci <b>„{NAZEV_STAVBY}"</b>.

Tato poptávka je do <b>{SOUTEZ_REALIZACE}</b>.
Současně zasílám odkaz na PD a výkaz výměr k ocenění.
{ODKAZ_DOKUMENTACE}

Termín realizace: <b>{TERMIN_REALIZACE}</b>
Termín dokončení stavby: <b>{TERMIN_DOKONCENI}</b>

V cenové nabídce by mělo být mimo jiné zahrnuto:
- splatnost: {SPLATNOST}
- záruka: {ZARUKA}
- zádržné: {POZASTAVKA}
- veškerý vodorovný a svislý přesun hmot
- doprava, likvidace odpadu
- montážní dokumentace včetně schválení zadavatelem
- předložení vzorků ke schválení
- kompletní spojovací materiál (kotvy, nýty, ukončovací lišty, separační pásky, tmely apod.)
- do ceny je nutné započítat vlastní manipulační techniku, manipulátor, jeřáb, montážní plošiny, lešení
- součást dodávky je i prověření požadovaných parametrů konstrukcí

<b>Cenovou nabídku zašlete, prosím, nejpozději do {TERMIN_POPTAVKY} do 12:00 hodin.
Prosím o zpětnou vazbu, zdali budete cenovou nabídku zpracovávat. V případě jejího odmítnutí prosím o oznámení této skutečnosti co nejdříve.</b>
V případě jakýchkoli dotazů mě neváhejte kontaktovat.

Děkuji.`,
        isDefault: true,
        lastModified: '2024-12-08'
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

export const getDefaultTemplate = async (): Promise<Template | undefined> => {
    try {
        // First try to find a template explicitly marked as default
        let { data, error } = await supabase
            .from('templates')
            .select('*')
            .eq('is_default', true)
            .limit(1)
            .single();

        // If no default found, get the first template (ordered by name)
        if (error || !data) {
            const result = await supabase
                .from('templates')
                .select('*')
                .order('name')
                .limit(1)
                .single();

            data = result.data;
            error = result.error;
        }

        if (error || !data) {
            // Fallback to INITIAL_TEMPLATES only if DB has no templates at all
            return INITIAL_TEMPLATES.find(t => t.isDefault);
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
        console.error('Failed to get default template', e);
        return INITIAL_TEMPLATES.find(t => t.isDefault);
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

        if (dbTemplate.is_default) {
            // Unset other defaults first to ensure only one default exists
            await supabase
                .from('templates')
                .update({ is_default: false })
                .eq('is_default', true);
        }

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
