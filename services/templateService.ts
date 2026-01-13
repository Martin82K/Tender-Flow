import { Template } from '../types';
import { supabase } from './supabase';

/**
 * Copy default templates from default_templates table to current user's templates
 */
const copyDefaultTemplatesForUser = async (): Promise<void> => {
    try {
        const { data: defaultTemplates, error: fetchError } = await supabase
            .from('default_templates')
            .select('*');

        if (fetchError) {
            console.error('Error fetching default templates:', fetchError);
            return;
        }

        if (!defaultTemplates || defaultTemplates.length === 0) {
            console.warn('No default templates found in database');
            return;
        }

        // Get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('No authenticated user found');
            return;
        }

        // Copy each default template to user's templates
        const templatesToInsert = defaultTemplates.map(dt => ({
            user_id: user.id,
            name: dt.name,
            subject: dt.subject,
            content: dt.content,
            is_default: dt.is_default,
            source_template_id: dt.id,
        }));

        const { error: insertError } = await supabase
            .from('templates')
            .insert(templatesToInsert);

        if (insertError) {
            console.error('Error copying default templates:', insertError);
        }
    } catch (e) {
        console.error('Failed to copy default templates', e);
    }
};

export const getTemplates = async (): Promise<Template[]> => {
    try {
        // RLS automatically filters by user_id = auth.uid()
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching templates:', error);
            return [];
        }

        // If user has no templates, copy defaults and retry
        if (!data || data.length === 0) {
            await copyDefaultTemplatesForUser();

            // Retry fetching after copying
            const { data: retryData, error: retryError } = await supabase
                .from('templates')
                .select('*')
                .order('name');

            if (retryError || !retryData) {
                console.error('Error fetching templates after copy:', retryError);
                return [];
            }

            return retryData.map(t => ({
                id: t.id,
                name: t.name,
                subject: t.subject,
                content: t.content,
                isDefault: t.is_default,
                lastModified: t.updated_at ? new Date(t.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            }));
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
        return [];
    }
};



export const getDefaultTemplate = async (): Promise<Template | undefined> => {
    try {
        // RLS automatically filters by user_id = auth.uid()
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
            console.error('No templates found for user');
            return undefined;
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
        return undefined;
    }
};



export const getTemplateById = async (id: string): Promise<Template | undefined> => {
    try {
        // RLS automatically filters by user_id = auth.uid()
        const { data, error } = await supabase
            .from('templates')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('Template not found:', id);
            return undefined;
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
        // Get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('No authenticated user found');
            return null;
        }

        // Map frontend model to DB model
        const dbTemplate = {
            name: template.name,
            subject: template.subject,
            content: template.content,
            is_default: template.isDefault,
            user_id: user.id, // Always set user_id to current user
            updated_at: new Date().toISOString()
        };

        if (dbTemplate.is_default) {
            // Unset other defaults first to ensure only one default exists per user
            await supabase
                .from('templates')
                .update({ is_default: false })
                .eq('user_id', user.id)
                .eq('is_default', true);
        }

        let result;

        // Check if it's a UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(template.id);

        if (isUUID) {
            // Update existing template
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
        return null;
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
