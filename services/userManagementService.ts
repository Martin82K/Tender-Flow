import { supabase } from './supabase';

// Types
export interface UserWithProfile {
    user_id: string;
    email: string;
    display_name: string;
    role_id: string | null;
    role_label: string | null;
    created_at: string;
    last_sign_in: string | null;
    auth_provider?: string | null;
    login_type?: string | null;
}

export interface Role {
    role_id: string;
    role_label: string;
    role_description: string | null;
    permissions: Record<string, boolean>;
}

export interface PermissionDefinition {
    key: string;
    label: string;
    description: string | null;
    category: string | null;
    sort_order: number;
}

// Service
export const userManagementService = {
    /**
     * Get all registered users (superadmin only)
     */
    getAllUsers: async (): Promise<UserWithProfile[]> => {
        const { data, error } = await supabase.rpc('get_all_users_admin');

        if (error) {
            console.error('Error fetching users:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    /**
     * Update a user's role (superadmin only)
     */
    updateUserRole: async (userId: string, roleId: string | null): Promise<boolean> => {
        const { data, error } = await supabase.rpc('update_user_role', {
            target_user_id: userId,
            new_role_id: roleId
        });

        if (error) {
            console.error('Error updating user role:', error);
            throw new Error(error.message);
        }

        return data;
    },

    /**
     * Update a user's login type label (admin only)
     * - null = auto (derived from Supabase auth provider)
     */
    updateUserLoginType: async (userId: string, loginType: string | null): Promise<boolean> => {
        const { data, error } = await supabase.rpc('update_user_login_type', {
            target_user_id: userId,
            new_login_type: loginType
        });

        if (error) {
            console.error('Error updating user login type:', error);
            throw new Error(error.message);
        }

        return data;
    },

    /**
     * Get all roles with their permissions
     */
    getRolesWithPermissions: async (): Promise<Role[]> => {
        const { data, error } = await supabase.rpc('get_roles_with_permissions');

        if (error) {
            console.error('Error fetching roles:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    /**
     * Get all permission definitions (for UI labels)
     */
    getPermissionDefinitions: async (): Promise<PermissionDefinition[]> => {
        const { data, error } = await supabase
            .from('permission_definitions')
            .select('*')
            .order('sort_order');

        if (error) {
            console.error('Error fetching permission definitions:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    /**
     * Update a role's permission (superadmin only)
     */
    updateRolePermission: async (
        roleId: string,
        permissionKey: string,
        enabled: boolean
    ): Promise<boolean> => {
        const { data, error } = await supabase.rpc('update_role_permission', {
            target_role_id: roleId,
            target_permission_key: permissionKey,
            new_enabled: enabled
        });

        if (error) {
            console.error('Error updating permission:', error);
            throw new Error(error.message);
        }

        return data;
    },

    /**
     * Get all available roles (for dropdown)
     */
    getAllRoles: async (): Promise<{ id: string; label: string }[]> => {
        const { data, error } = await supabase
            .from('user_roles')
            .select('id, label')
            .order('sort_order');

        if (error) {
            console.error('Error fetching roles:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    /**
     * Extract unique domains from user emails
     */
    getUniqueDomains: (users: UserWithProfile[]): string[] => {
        const domains = new Set<string>();
        users.forEach(user => {
            const domain = user.email.split('@')[1];
            if (domain) domains.add(domain);
        });
        return Array.from(domains).sort();
    },

    /**
     * Filter users by search query and domain
     */
    filterUsers: (
        users: UserWithProfile[],
        searchQuery: string,
        domainFilter: string
    ): UserWithProfile[] => {
        return users.filter(user => {
            // Domain filter
            if (domainFilter) {
                const userDomain = user.email.split('@')[1];
                if (userDomain !== domainFilter) return false;
            }

            // Search filter (email or display name)
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchEmail = user.email.toLowerCase().includes(query);
                const matchName = user.display_name?.toLowerCase().includes(query);
                if (!matchEmail && !matchName) return false;
            }

            return true;
        });
    },

    /**
     * Get all whitelisted emails
     */
    getWhitelistedEmails: async (): Promise<WhitelistedEmail[]> => {
        const { data, error } = await supabase.rpc('get_whitelisted_emails');

        if (error) {
            console.error('Error fetching whitelist:', error);
            throw new Error(error.message);
        }

        return data || [];
    },

    /**
     * Add email to whitelist
     */
    addWhitelistedEmail: async (email: string, displayName?: string, notes?: string): Promise<string> => {
        const { data, error } = await supabase.rpc('add_whitelisted_email', {
            email_input: email,
            display_name_input: displayName || null,
            notes_input: notes || null
        });

        if (error) {
            console.error('Error adding to whitelist:', error);
            throw new Error(error.message);
        }

        return data; // Returns the UUID
    },

    /**
     * Remove email from whitelist
     */
    removeWhitelistedEmail: async (id: string): Promise<boolean> => {
        const { data, error } = await supabase.rpc('remove_whitelisted_email', {
            email_id: id
        });

        if (error) {
            console.error('Error removing from whitelist:', error);
            throw new Error(error.message);
        }

        return data;
    },

    /**
     * Toggle active status of whitelisted email
     */
    toggleWhitelistedEmail: async (id: string, newActive: boolean): Promise<boolean> => {
        const { data, error } = await supabase.rpc('toggle_whitelisted_email', {
            email_id: id,
            new_active: newActive
        });

        if (error) {
            console.error('Error toggling whitelist status:', error);
            throw new Error(error.message);
        }

        return data;
    }
};

export interface WhitelistedEmail {
    id: string;
    email: string;
    domain: string;
    display_name: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
}
