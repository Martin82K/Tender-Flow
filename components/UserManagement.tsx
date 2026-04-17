import React, { useState, useEffect } from "react";
import {
  userManagementService,
  UserWithProfile,
} from "../services/userManagementService";
import { useUI } from "../context/UIContext";
import { getTierLabel, getTierBadgeClass } from "../config/subscriptionTiers";

interface UserManagementProps {
  isAdmin: boolean;
}

export const UserManagement: React.FC<UserManagementProps> = ({ isAdmin }) => {
  const { showAlert } = useUI();
  // Users state
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("");

  // Loading state for individual updates
  const [updatingLoginTypeUserId, setUpdatingLoginTypeUserId] = useState<
    string | null
  >(null);

  // Load data on mount
  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await userManagementService.getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error("Failed to load users:", error);
      showAlert({
        title: "Chyba",
        message: "Chyba při načítání uživatelů.",
        variant: "danger",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleLoginTypeChange = async (userId: string, loginType: string) => {
    setUpdatingLoginTypeUserId(userId);
    try {
      const normalized = loginType.trim().toLowerCase();
      const next = normalized ? normalized : null;
      await userManagementService.updateUserLoginType(userId, next);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, login_type: next } : u))
      );
    } catch (error) {
      console.error("Failed to update login type:", error);
      showAlert({
        title: "Chyba",
        message: "Chyba při změně typu přihlášení.",
        variant: "danger",
      });
    } finally {
      setUpdatingLoginTypeUserId(null);
    }
  };

  // Get unique domains for filter
  const domains = userManagementService.getUniqueDomains(users);

  // Filter users
  const filteredUsers = userManagementService.filterUsers(
    users,
    searchQuery,
    domainFilter,
    "all"
  );

  if (!isAdmin) return null;

  return (
    <>
      {/* User Management Section */}
      <section className="bg-white dark:bg-slate-950 dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-slate-950/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 shadow-xl mb-8">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">group</span>
          Správa uživatelů
          <span className="ml-2 px-2.5 py-1 bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/30">
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
                className="w-full rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="w-[180px]">
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="w-full rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary/50 focus:outline-none"
            >
              <option value="">Všechny domény</option>
              {domains.map((domain) => (
                <option key={domain} value={domain}>
                  @{domain}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Users Table */}
        {isLoadingUsers ? (
          <div className="flex justify-center py-8">
            <span className="material-symbols-outlined animate-spin text-slate-400 text-[32px]">
              sync
            </span>
          </div>
        ) : (
          <div className="table-responsive overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/50">
                  <th className="w-[220px] text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                    Email
                  </th>
                  <th className="w-[110px] text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                    Jméno
                  </th>
                  <th className="w-[95px] text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                    Doména
                  </th>
                  <th className="w-[132px] text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                    Přihlášení
                  </th>
                  <th className="w-[150px] text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2">
                    Org. plán
                  </th>
                  <th className="w-[86px] text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider py-3 px-2 hidden xl:table-cell">
                    Registrace
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-8 text-slate-500 italic"
                    >
                      Žádní uživatelé nenalezeni
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.user_id}
                      className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full bg-gradient-to-tr from-primary to-primary/70 flex items-center justify-center text-white text-xs font-bold">
                            {user.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-900 dark:text-white truncate">
                            {user.email}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="block text-sm text-slate-700 dark:text-slate-300 truncate">
                          {user.display_name || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-block max-w-full truncate text-xs bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 px-2 py-1 rounded border border-slate-200 dark:border-slate-600/50">
                          @{user.email.split("@")[1]}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="relative">
                          <select
                            value={(user.login_type || "").toLowerCase()}
                            onChange={(e) =>
                              handleLoginTypeChange(
                                user.user_id,
                                e.target.value
                              )
                            }
                            disabled={updatingLoginTypeUserId === user.user_id}
                            className="w-full rounded-lg bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600/50 px-2 py-1.5 text-sm text-slate-900 dark:text-white focus:border-primary/50 focus:outline-none disabled:opacity-50 min-w-0"
                          >
                            <option value="">{`Auto (${(
                              user.auth_provider || "email"
                            ).toLowerCase()})`}</option>
                            <option value="email">Email</option>
                            <option value="google">Google</option>
                            <option value="azure">Microsoft (Azure)</option>
                            <option value="github">GitHub</option>
                            <option value="saml">SAML</option>
                          </select>
                          {updatingLoginTypeUserId === user.user_id && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined animate-spin text-primary text-[16px]">
                              sync
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg ${getTierBadgeClass(
                            (user.org_subscription_tier || "free") as any
                          )}`}
                        >
                          {getTierLabel((user.org_subscription_tier || "free") as any)}
                        </span>
                      </td>
                      <td className="py-3 px-2 hidden xl:table-cell">
                        <span className="text-xs text-slate-500">
                          {new Date(user.created_at).toLocaleDateString(
                            "cs-CZ"
                          )}
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
            className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${isLoadingUsers ? "animate-spin" : ""
                }`}
            >
              refresh
            </span>
            Obnovit
          </button>
        </div>
      </section>
    </>
  );
};
