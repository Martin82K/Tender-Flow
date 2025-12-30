import React, { useState, useEffect } from 'react';
import {
    userManagementService,
    UserWithProfile,
    Role,
    PermissionDefinition
} from '../services/userManagementService';

interface UserManagementProps {
    isAdmin: boolean;
}

export const UserManagement: React.FC<UserManagementProps> = ({ isAdmin }) => {
    // Users state
    const [users, setUsers] = useState<UserWithProfile[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [domainFilter, setDomainFilter] = useState('');

    // Roles state
    const [roles, setRoles] = useState<Role[]>([]);
    const [availableRoles, setAvailableRoles] = useState<{ id: string; label: string }[]>([]);
    const [permissionDefs, setPermissionDefs] = useState<PermissionDefinition[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(true);
    const [expandedRole, setExpandedRole] = useState<string | null>(null);

    // Loading state for individual updates
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
    const [updatingPermission, setUpdatingPermission] = useState<string | null>(null);

    // Load data on mount
    useEffect(() => {
        if (isAdmin) {
            loadUsers();
            loadRoles();
        }
    }, [isAdmin]);

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const data = await userManagementService.getAllUsers();
            setUsers(data);
        } catch (error) {
            console.error('Failed to load users:', error);
            alert('Chyba při načítání uživatelů');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const loadRoles = async () => {
        setIsLoadingRoles(true);
        try {
            const [rolesData, availableRolesData, defsData] = await Promise.all([
                userManagementService.getRolesWithPermissions(),
                userManagementService.getAllRoles(),
                userManagementService.getPermissionDefinitions()
            ]);
            setRoles(rolesData);
            setAvailableRoles(availableRolesData);
            setPermissionDefs(defsData);
        } catch (error) {
            console.error('Failed to load roles:', error);
            alert('Chyba při načítání rolí');
        } finally {
            setIsLoadingRoles(false);
        }
    };

    const handleRoleChange = async (userId: string, roleId: string) => {
        setUpdatingUserId(userId);
        try {
            await userManagementService.updateUserRole(userId, roleId || null);
            // Update local state
            setUsers(prev => prev.map(u =>
                u.user_id === userId
                    ? { ...u, role_id: roleId, role_label: availableRoles.find(r => r.id === roleId)?.label || null }
                    : u
            ));
        } catch (error) {
            console.error('Failed to update role:', error);
            alert('Chyba při změně role');
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handlePermissionChange = async (roleId: string, permissionKey: string, enabled: boolean) => {
        const updateKey = `${roleId}-${permissionKey}`;
        setUpdatingPermission(updateKey);
        try {
            await userManagementService.updateRolePermission(roleId, permissionKey, enabled);
            // Update local state
            setRoles(prev => prev.map(r =>
                r.role_id === roleId
                    ? { ...r, permissions: { ...r.permissions, [permissionKey]: enabled } }
                    : r
            ));
        } catch (error) {
            console.error('Failed to update permission:', error);
            alert('Chyba při změně oprávnění');
        } finally {
            setUpdatingPermission(null);
        }
    };

    // Get unique domains for filter
    const domains = userManagementService.getUniqueDomains(users);

    // Filter users
    const filteredUsers = userManagementService.filterUsers(users, searchQuery, domainFilter);

    // Group permissions by category
    const permissionsByCategory = permissionDefs.reduce((acc, perm) => {
        const category = perm.category || 'Ostatní';
        if (!acc[category]) acc[category] = [];
        acc[category].push(perm);
        return acc;
    }, {} as Record<string, PermissionDefinition[]>);

    if (!isAdmin) return null;

    return (
        <>
            {/* User Management Section */}
            <section className="bg-white dark:bg-slate-950 dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-slate-950/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-cyan-400">group</span>
                    Správa uživatelů
                    <span className="ml-2 px-2.5 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded-lg border border-cyan-500/30">
                        Admin
                    </span>
                </h2>

                {/* Search and Filter */}
                <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[20px]">
                                search
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Hledat podle jména nebo emailu..."
                                className="w-full rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="w-[180px]">
                        <select
                            value={domainFilter}
                            onChange={(e) => setDomainFilter(e.target.value)}
                            className="w-full rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-cyan-500/50 focus:outline-none"
                        >
                            <option value="">Všechny domény</option>
                            {domains.map(domain => (
                                <option key={domain} value={domain}>@{domain}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Users Table */}
                {isLoadingUsers ? (
                    <div className="flex justify-center py-8">
                        <span className="material-symbols-outlined animate-spin text-slate-400 text-[32px]">sync</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700/50">
                                    <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                                        Email
                                    </th>
                                    <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                                        Jméno
                                    </th>
                                    <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                                        Doména
                                    </th>
                                    <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                                        Role
                                    </th>
                                    <th className="text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                                        Registrace
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-slate-500 italic">
                                            Žádní uživatelé nenalezeni
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map(user => (
                                        <tr key={user.user_id} className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 px-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="size-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                                        {user.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm text-slate-900 dark:text-white">{user.email}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                                    {user.display_name || '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2">
                                                <span className="text-xs bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 px-2 py-1 rounded border border-slate-200 dark:border-slate-600/50">
                                                    @{user.email.split('@')[1]}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2">
                                                <div className="relative">
                                                    <select
                                                        value={user.role_id || ''}
                                                        onChange={(e) => handleRoleChange(user.user_id, e.target.value)}
                                                        disabled={updatingUserId === user.user_id}
                                                        className="rounded-lg bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600/50 px-2 py-1.5 text-sm text-slate-900 dark:text-white focus:border-cyan-500/50 focus:outline-none disabled:opacity-50 min-w-[140px]"
                                                    >
                                                        <option value="">Bez role</option>
                                                        {availableRoles.map(role => (
                                                            <option key={role.id} value={role.id}>{role.label}</option>
                                                        ))}
                                                    </select>
                                                    {updatingUserId === user.user_id && (
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined animate-spin text-cyan-400 text-[16px]">
                                                            sync
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                <span className="text-xs text-slate-500">
                                                    {new Date(user.created_at).toLocaleDateString('cs-CZ')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
                    <span className="text-xs text-slate-500">
                        Zobrazeno {filteredUsers.length} z {users.length} uživatelů
                    </span>
                    <button
                        onClick={loadUsers}
                        disabled={isLoadingUsers}
                        className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                    >
                        <span className={`material-symbols-outlined text-[16px] ${isLoadingUsers ? 'animate-spin' : ''}`}>
                            refresh
                        </span>
                        Obnovit
                    </button>
                </div>
            </section>

            {/* Role Permissions Section */}
            <section className="bg-white dark:bg-slate-950 dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-slate-950/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400">shield_person</span>
                    Nastavení oprávnění rolí
                    <span className="ml-2 px-2.5 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-lg border border-amber-500/30">
                        Admin
                    </span>
                </h2>

                {isLoadingRoles ? (
                    <div className="flex justify-center py-8">
                        <span className="material-symbols-outlined animate-spin text-slate-400 text-[32px]">sync</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {roles.map(role => (
                            <div key={role.role_id} className="border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden">
                                {/* Role Header */}
                                <button
                                    onClick={() => setExpandedRole(expandedRole === role.role_id ? null : role.role_id)}
                                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors text-slate-800 dark:text-white"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`material-symbols-outlined text-[20px] transition-transform ${expandedRole === role.role_id ? 'rotate-90' : ''}`}>
                                            chevron_right
                                        </span>
                                        <span className="font-bold">{role.role_label}</span>
                                        {role.role_description && (
                                            <span className="text-xs text-slate-500 hidden sm:inline">
                                                — {role.role_description}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">
                                            {Object.values(role.permissions).filter(Boolean).length} /
                                            {Object.keys(role.permissions).length} oprávnění
                                        </span>
                                    </div>
                                </button>

                                {/* Role Permissions (Expanded) */}
                                {expandedRole === role.role_id && (
                                    <div className="p-4 bg-white dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/50">
                                        {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                                            <div key={category} className="mb-4 last:mb-0">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                    {category}
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {permissions.map(perm => {
                                                        const isEnabled = role.permissions[perm.key] ?? false;
                                                        const isUpdating = updatingPermission === `${role.role_id}-${perm.key}`;

                                                        return (
                                                            <label
                                                                key={perm.key}
                                                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${isEnabled
                                                                        ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                                                                        : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isEnabled}
                                                                    onChange={(e) => handlePermissionChange(role.role_id, perm.key, e.target.checked)}
                                                                    disabled={isUpdating}
                                                                    className="sr-only"
                                                                />
                                                                <div className={`size-5 rounded flex items-center justify-center transition-colors ${isEnabled
                                                                        ? 'bg-emerald-500 text-white'
                                                                        : 'bg-slate-300 dark:bg-slate-700 text-transparent'
                                                                    }`}>
                                                                    {isUpdating ? (
                                                                        <span className="material-symbols-outlined animate-spin text-[14px] text-white">sync</span>
                                                                    ) : (
                                                                        <span className="material-symbols-outlined text-[14px]">check</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`text-sm font-medium truncate ${isEnabled ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                        {perm.label}
                                                                    </p>
                                                                    {perm.description && (
                                                                        <p className="text-[10px] text-slate-500 truncate">
                                                                            {perm.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </>
    );
};
