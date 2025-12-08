import { supabase } from './supabase';
import { Project } from '../types';

export const projectService = {
    // Fetch projects (will only return owned or shared due to RLS)
    getProjects: async (): Promise<Project[]> => {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(p => ({
            id: p.id,
            name: p.name,
            location: p.location || '',
            status: p.status || 'realization',
            ownerId: p.owner_id, // Need to add to type if not exists
            isDemo: p.is_demo
        }));
    },

    createProject: async (project: Project): Promise<void> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await supabase.from('projects').insert({
            id: project.id,
            name: project.name,
            location: project.location,
            status: project.status,
            owner_id: user.id
        });

        if (error) throw error;
    },

    updateProject: async (id: string, updates: Partial<Project>): Promise<void> => {
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.location) dbUpdates.location = updates.location;
        if (updates.status) dbUpdates.status = updates.status;

        const { error } = await supabase
            .from('projects')
            .update(dbUpdates)
            .eq('id', id);

        if (error) throw error;
    },

    deleteProject: async (id: string, isDemo: boolean = false): Promise<void> => {
        if (isDemo) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from("user_hidden_projects").insert({
                    user_id: user.id,
                    project_id: id
                });
            }
        } else {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id);

            if (error) throw error;
        }
    },

    // Sharing Methods
    shareProject: async (projectId: string, email: string): Promise<void> => {
        // 1. Find user by email
        // Note: This requires a way to look up user IDs by email. 
        // Standard Supabase configured typically doesn't allow searching auth.users directly from client for security.
        // We might need an Edge Function or RPC.
        // For now, I'll assume we used the `search_user_by_email` RPC if it exists, or I will create one in the migration.

        // Wait, I should add a helper RPC for this in the migration if I want to look up users safely.
        // Or I can just try to insert and let the backend handle it? No, I need the UUID.

        // Let's add an RPC to the migration file quickly using `rpc` call.
        const { data: userData, error: userError } = await supabase
            .rpc('get_user_id_by_email', { email_input: email });

        if (userError || !userData) throw new Error('Uživatel s tímto emailem nebyl nalezen.');

        const userId = userData;

        const { error } = await supabase
            .from('project_shares')
            .insert({
                project_id: projectId,
                user_id: userId,
                permission: 'edit'
            });

        if (error) {
            if (error.code === '23505') throw new Error('Tento uživatel již má přístup k projektu.');
            throw error;
        }
    },

    getProjectShares: async (projectId: string) => {
        // We need to join with profiles or something to get emails.
        // But auth.users is not joinable directly easily.
        // Maybe we store email in `project_shares`? No, normalization.
        // Use RPC to fetch shares with emails?

        const { data, error } = await supabase
            .rpc('get_project_shares_debug', { project_id_input: projectId });

        if (error) throw error;
        return data as { user_id: string, email: string, permission: string }[];
    },

    removeShare: async (projectId: string, userId: string): Promise<void> => {
        const { error } = await supabase
            .from('project_shares')
            .delete()
            .match({ project_id: projectId, user_id: userId });

        if (error) throw error;
    }
};
