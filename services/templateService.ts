import { Template } from '../types';
import { supabase } from './supabase';

type TemplateScope = {
    projectId?: string | null;
};

type DbTemplate = {
    id: string;
    project_id?: string | null;
    name: string;
    subject: string;
    content: string;
    is_default: boolean;
    updated_at?: string | null;
};

type TemplateSeed = {
    name: string;
    subject: string;
    content: string;
    is_default: boolean;
    source_template_id?: string | null;
};

const templateDate = (updatedAt?: string | null): string =>
    updatedAt ? new Date(updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

const mapTemplateFromDb = (template: DbTemplate): Template => ({
    id: template.id,
    projectId: template.project_id ?? null,
    name: template.name,
    subject: template.subject,
    content: template.content,
    isDefault: template.is_default,
    lastModified: templateDate(template.updated_at),
});

const hasProjectScope = (scope?: TemplateScope): scope is { projectId: string } =>
    typeof scope?.projectId === 'string' && scope.projectId.trim().length > 0;

const getCurrentUserId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error('No authenticated user found');
        return null;
    }
    return user.id;
};

/**
 * Copy default templates from default_templates table to current user's scoped templates.
 */
const copyDefaultTemplatesForUser = async (scope?: TemplateScope): Promise<void> => {
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

        const userId = await getCurrentUserId();
        if (!userId) return;

        // Copy each default template to user's templates
        const templatesToInsert = defaultTemplates.map(dt => ({
            user_id: userId,
            project_id: hasProjectScope(scope) ? scope.projectId : null,
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

const copyLegacyUserTemplatesForProject = async (scope?: TemplateScope): Promise<boolean> => {
    if (!hasProjectScope(scope)) return false;

    try {
        const userId = await getCurrentUserId();
        if (!userId) return false;

        const { data: legacyTemplates, error: fetchError } = await supabase
            .from('templates')
            .select('name, subject, content, is_default, source_template_id')
            .eq('user_id', userId)
            .is('project_id', null)
            .order('name');

        if (fetchError) {
            console.error('Error fetching legacy user templates:', fetchError);
            return false;
        }

        if (!legacyTemplates || legacyTemplates.length === 0) return false;

        const templatesToInsert = (legacyTemplates as TemplateSeed[]).map(template => ({
            user_id: userId,
            project_id: scope.projectId,
            name: template.name,
            subject: template.subject,
            content: template.content,
            is_default: template.is_default,
            source_template_id: template.source_template_id ?? null,
        }));

        const { error: insertError } = await supabase
            .from('templates')
            .insert(templatesToInsert);

        if (insertError) {
            console.error('Error copying legacy user templates:', insertError);
            return false;
        }

        return true;
    } catch (e) {
        console.error('Failed to copy legacy user templates', e);
        return false;
    }
};

const ensureTemplatesForScope = async (scope?: TemplateScope): Promise<void> => {
    const copiedLegacyTemplates = await copyLegacyUserTemplatesForProject(scope);
    if (!copiedLegacyTemplates) {
        await copyDefaultTemplatesForUser(scope);
    }
};

export const getTemplates = async (scope?: TemplateScope): Promise<Template[]> => {
    try {
        // RLS automatically filters by user_id = auth.uid()
        let query = supabase
            .from('templates')
            .select('*')
            .order('name');

        query = hasProjectScope(scope)
            ? query.eq('project_id', scope.projectId)
            : query.is('project_id', null);

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching templates:', error);
            return [];
        }

        // If user has no scoped templates, copy legacy user templates first.
        // This preserves existing custom text but isolates it per project.
        if (!data || data.length === 0) {
            await ensureTemplatesForScope(scope);

            // Retry fetching after copying
            let retryQuery = supabase
                .from('templates')
                .select('*')
                .order('name');

            retryQuery = hasProjectScope(scope)
                ? retryQuery.eq('project_id', scope.projectId)
                : retryQuery.is('project_id', null);

            const { data: retryData, error: retryError } = await retryQuery;

            if (retryError || !retryData) {
                console.error('Error fetching templates after copy:', retryError);
                return [];
            }

            return retryData.map(mapTemplateFromDb);
        }

        return data.map(mapTemplateFromDb);
    } catch (e) {
        console.error('Failed to load templates', e);
        return [];
    }
};



export const getDefaultTemplate = async (scope?: TemplateScope): Promise<Template | undefined> => {
    try {
        // RLS automatically filters by user_id = auth.uid()
        // First try to find a template explicitly marked as default
        let defaultQuery = supabase
            .from('templates')
            .select('*')
            .eq('is_default', true);

        defaultQuery = hasProjectScope(scope)
            ? defaultQuery.eq('project_id', scope.projectId)
            : defaultQuery.is('project_id', null);

        let { data, error } = await defaultQuery.limit(1).single();

        if ((error || !data) && hasProjectScope(scope)) {
            await ensureTemplatesForScope(scope);
            let retryDefaultQuery = supabase
                .from('templates')
                .select('*')
                .eq('is_default', true)
                .eq('project_id', scope.projectId);
            const retryResult = await retryDefaultQuery.limit(1).single();
            data = retryResult.data;
            error = retryResult.error;
        }

        // If no default found, get the first template (ordered by name)
        if (error || !data) {
            let fallbackQuery = supabase
                .from('templates')
                .select('*')
                .order('name');

            fallbackQuery = hasProjectScope(scope)
                ? fallbackQuery.eq('project_id', scope.projectId)
                : fallbackQuery.is('project_id', null);

            const result = await fallbackQuery.limit(1).single();

            data = result.data;
            error = result.error;
        }

        if (error || !data) {
            console.error('No templates found for user');
            return undefined;
        }

        return mapTemplateFromDb(data);
    } catch (e) {
        console.error('Failed to get default template', e);
        return undefined;
    }
};



export const getTemplateById = async (id: string, scope?: TemplateScope): Promise<Template | undefined> => {
    try {
        // RLS automatically filters by user_id = auth.uid()
        let query = supabase
            .from('templates')
            .select('*')
            .eq('id', id);

        query = hasProjectScope(scope)
            ? query.eq('project_id', scope.projectId)
            : query.is('project_id', null);

        const { data, error } = await query.maybeSingle();

        if (error) {
            console.error('Error fetching template:', error);
            return undefined;
        }

        if (!data) return undefined;

        return mapTemplateFromDb(data);
    } catch (e) {
        console.error('Failed to get template by id', e);
        return undefined;
    }
};



export const saveTemplate = async (template: Template, scope?: TemplateScope): Promise<Template | null> => {
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
            project_id: hasProjectScope(scope) ? scope.projectId : null,
            user_id: user.id, // Always set user_id to current user
            updated_at: new Date().toISOString()
        };

        if (dbTemplate.is_default) {
            // Unset other defaults first to ensure only one default exists per user
            let unsetDefaultQuery = supabase
                .from('templates')
                .update({ is_default: false })
                .eq('user_id', user.id);

            unsetDefaultQuery = hasProjectScope(scope)
                ? unsetDefaultQuery.eq('project_id', scope.projectId)
                : unsetDefaultQuery.is('project_id', null);

            await unsetDefaultQuery.eq('is_default', true);
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

        return mapTemplateFromDb(result);
    } catch (e) {
        console.error('Failed to save template', e);
        return null;
    }
};


export const deleteTemplate = async (id: string, scope?: TemplateScope): Promise<boolean> => {
    try {
        let query = supabase
            .from('templates')
            .delete()
            .eq('id', id);

        query = hasProjectScope(scope)
            ? query.eq('project_id', scope.projectId)
            : query.is('project_id', null);

        const { error } = await query;

        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Failed to delete template', e);
        return false;
    }
};
